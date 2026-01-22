"""
Observability tracking for LLM usage, token consumption, and costs.
Integrates with Google's ADK and LiteLLM for comprehensive monitoring.
"""

import time
import json
import litellm
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
import threading

# ============================================================================
# GLOBAL CONSTANTS - Configuration values for observability tracking
# ============================================================================

# Token calculation constant
# LLM pricing is quoted per 1 million tokens (e.g., "$5.00 per 1M tokens")
TOKENS_PER_MILLION = 1_000_000

# Web scraping configuration
# Timeout in seconds for HTTP requests when fetching pricing from the internet
WEB_REQUEST_TIMEOUT_SECONDS = 5

# Default limits for data retrieval
# Default number of hours to include in hourly breakdown statistics
DEFAULT_HOURLY_BREAKDOWN_HOURS = 24

# Default number of recent requests to return when querying request history
DEFAULT_RECENT_REQUESTS_LIMIT = 50

# Enable LiteLLM debug logging to see if callbacks are firing
# litellm._turn_on_debug()

@dataclass
class LLMRequest:
    """Represents a single LLM request with all relevant metrics."""
    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost: float
    input_cost: float
    output_cost: float
    latency_ms: float
    success: bool
    error: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    agent_name: Optional[str] = None

class ObservabilityTracker:
    """Thread-safe observability tracker for LLM usage statistics."""
    
    def __init__(self):
        """
        Initialize the observability tracker.
        
        This tracker stores all LLM requests in memory and provides statistics.
        All operations are thread-safe using locks.
        """
        # List to store all tracked LLM requests
        self._requests: List[LLMRequest] = []
        
        # Lock for thread-safe access to the requests list
        self._lock = threading.Lock()
    
    def _fetch_pricing_from_web(self, model: str) -> Optional[Dict[str, float]]:
        """
        Fetch latest LLM pricing from the internet using web scraping.
        
        This is a fallback strategy when LiteLLM doesn't have the model pricing.
        We scrape from langcopilot.com which maintains up-to-date pricing for all LLMs.
        
        Args:
            model: The model name to search for (e.g., "gpt-4.1", "claude-3-opus")
        
        Returns:
            dict: {"input_per_1m": price_per_1M, "output_per_1m": price_per_1M, "last_updated": timestamp, "source": "web"}
            None: If pricing couldn't be found or scraping failed
        """
        try:
            import requests
            from datetime import datetime
            
            # ========================================================================
            # STEP 1: Convert model name to URL-friendly slug
            # ========================================================================
            # Example: "gpt-4/turbo" → "gpt-4-turbo"
            # This matches the URL format used by langcopilot.com
            model_slug = model.lower().replace("/", "-").replace("_", "-")
            
            # ========================================================================
            # STEP 2: Build the pricing page URL
            # ========================================================================
            # langcopilot.com has pricing pages in format:
            # https://www.langcopilot.com/llm-pricing/{provider}/{model-slug}
            # We assume OpenAI provider as default (can be extended for other providers)
            url = f"https://www.langcopilot.com/llm-pricing/openai/{model_slug}"
            print(f"[Observability] Fetching pricing from: {url}")
            
            # ========================================================================
            # STEP 3: Make HTTP request to the pricing page
            # ========================================================================
            # Make HTTP request with configured timeout
            response = requests.get(url, timeout=WEB_REQUEST_TIMEOUT_SECONDS)
            
            if response.status_code == 200:
                # Successfully retrieved the page HTML
                text = response.text
                
                # ====================================================================
                # STEP 4: Parse HTML to extract pricing information
                # ====================================================================
                # Look for text patterns like:
                # "$5.00 per 1M input tokens"
                # "$15.00 per 1M output tokens"
                if "per 1M input tokens" in text and "per 1M output tokens" in text:
                    import re
                    
                    # Regex pattern to match pricing:
                    # \$          - Literal dollar sign
                    # (\d+\.?\d*) - Capture group: digits with optional decimal (e.g., "5", "5.00", "0.50")
                    # \s*         - Optional whitespace
                    # (?:/\s*)?   - Optional "/" with whitespace
                    # (?:per\s*)? - Optional "per " (non-capturing)
                    # 1M input tokens - Literal text we're looking for
                    input_match = re.search(r'\$(\d+\.?\d*)\s*(?:/\s*)?(?:per\s*)?1M input tokens', text)
                    output_match = re.search(r'\$(\d+\.?\d*)\s*(?:/\s*)?(?:per\s*)?1M output tokens', text)
                    
                    if input_match and output_match:
                        # ============================================================
                        # STEP 5: Extract the numeric values and create pricing dict
                        # ============================================================
                        # .group(1) gets the captured number from the regex
                        pricing = {
                            "input_per_1m": float(input_match.group(1)),   # Price per 1M input tokens
                            "output_per_1m": float(output_match.group(1)), # Price per 1M output tokens
                            "last_updated": datetime.now().isoformat(),  # Timestamp of fetch
                            "source": "web"  # Indicate this came from web scraping
                        }
                        print(f"[Observability] ✓ Fetched pricing from web for {model}: "
                              f"${pricing['input_per_1m']:.2f}/${pricing['output_per_1m']:.2f} per 1M tokens")
                        return pricing
                    else:
                        print(f"[Observability] ⚠️  Could not parse pricing from page (regex didn't match)")
                else:
                    print(f"[Observability] ⚠️  Pricing text not found on page")
            else:
                print(f"[Observability] ⚠️  HTTP {response.status_code} - page not found")
                
        except Exception as e:
            print(f"[Observability] ❌ Failed to fetch pricing from web for {model}: {e}")
        
        # If we got here, web scraping failed
        return None
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> tuple[float, float, float]:
        """
        Calculate cost for a request based on model and token usage.
        
        STRATEGY 1: Try LiteLLM's built-in pricing database (most reliable)
        STRATEGY 2: If Strategy 1 fails, fetch pricing from the internet
        
        Args:
            model: The model name (e.g., "gpt-4.1", "gpt-3.5-turbo")
            input_tokens: Number of input/prompt tokens used
            output_tokens: Number of output/completion tokens used
        
        Returns:
            tuple: (total_cost, input_cost, output_cost) in USD
        """
        
        # ============================================================================
        # STRATEGY 1: LiteLLM's Built-in Pricing Database
        # ============================================================================
        # LiteLLM maintains an up-to-date pricing database for all major LLM providers
        # Source: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
        # This is updated regularly when you upgrade the litellm package
        # The cost_per_token() function returns the actual cost in USD for the tokens used
        try:
            # Call LiteLLM's cost_per_token function
            # It takes the model name and token counts, returns actual costs (not per-million rates)
            input_cost_per_token, output_cost_per_token = litellm.cost_per_token(
                model=model,  # Model identifier (e.g., "gpt-4", "claude-3-opus")
                prompt_tokens=input_tokens,  # Number of input tokens
                completion_tokens=output_tokens  # Number of output tokens
            )
            
            # These are the actual costs in USD (already calculated by LiteLLM)
            input_cost = input_cost_per_token
            output_cost = output_cost_per_token
            
            print(f"[Observability] ✓ Using LiteLLM pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
            return (input_cost + output_cost, input_cost, output_cost)
            
        except Exception as e:
            # LiteLLM doesn't have pricing for this model (new model, custom model, etc.)
            print(f"[Observability] LiteLLM pricing not available for {model}: {e}")
            print(f"[Observability] Attempting internet search for pricing...")
        
        # ============================================================================
        # STRATEGY 2: Internet Search for Pricing (Fallback)
        # ============================================================================
        # If LiteLLM doesn't have the model, we scrape pricing from langcopilot.com
        # This site maintains a comprehensive database of LLM pricing across providers
        pricing_data = self._fetch_pricing_from_web(model)
        
        if pricing_data:
            # pricing_data format: {"input_per_1m": price_per_1M, "output_per_1m": price_per_1M}
            # Example: {"input_per_1m": 5.00, "output_per_1m": 15.00} means $5 per 1M input, $15 per 1M output
            
            # Calculate actual cost by converting tokens to millions, then multiply by rate
            # Formula: (tokens_used / TOKENS_PER_MILLION) * price_per_million_tokens
            # Example: (12,000 tokens / 1,000,000) * $5.00 per 1M = 0.012 * $5.00 = $0.06
            input_cost = (input_tokens / TOKENS_PER_MILLION) * pricing_data["input_per_1m"]
            output_cost = (output_tokens / TOKENS_PER_MILLION) * pricing_data["output_per_1m"]
            
            print(f"[Observability] ✓ Using web-fetched pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
            return (input_cost + output_cost, input_cost, output_cost)
        
        # ============================================================================
        # NO PRICING FOUND - RAISE ERROR
        # ============================================================================
        # If both strategies fail, raise an error instead of using a fallback
        error_msg = (
            f"No pricing data found for model '{model}'. "
            f"Please either:\n"
            f"  1. Update LiteLLM package: pip install --upgrade litellm\n"
            f"  2. Verify the model name is correct\n"
            f"  3. Add manual pricing for this model to the pricing database"
        )
        print(f"[Observability] ❌ ERROR: {error_msg}")
        raise ValueError(error_msg)
    
    def track_request(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float,
        success: bool,
        error: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        agent_name: Optional[str] = None
    ):
        """Track a single LLM request."""
        total_tokens = input_tokens + output_tokens
        cost, input_cost, output_cost = self.calculate_cost(model, input_tokens, output_tokens)
        
        request = LLMRequest(
            timestamp=datetime.now().isoformat(),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost=cost,
            input_cost=input_cost,
            output_cost=output_cost,
            latency_ms=latency_ms,
            success=success,
            error=error,
            user_id=user_id,
            session_id=session_id,
            agent_name=agent_name
        )
        
        with self._lock:
            self._requests.append(request)
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """Get summary statistics for all requests."""
        with self._lock:
            if not self._requests:
                return {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "success_rate": 0.0,
                    "total_tokens_input": 0,
                    "total_tokens_output": 0,
                    "total_tokens": 0,
                    "total_cost_usd": 0.0,
                    "input_cost_usd": 0.0,
                    "output_cost_usd": 0.0,
                    "average_latency_ms": 0.0
                }
            
            successful = [r for r in self._requests if r.success]
            failed = [r for r in self._requests if not r.success]
            
            total_input_tokens = sum(r.input_tokens for r in self._requests)
            total_output_tokens = sum(r.output_tokens for r in self._requests)
            total_cost = sum(r.cost for r in self._requests)
            input_cost = sum(r.input_cost for r in self._requests)
            output_cost = sum(r.output_cost for r in self._requests)
            avg_latency = sum(r.latency_ms for r in self._requests) / len(self._requests)
            
            return {
                "total_requests": len(self._requests),
                "successful_requests": len(successful),
                "failed_requests": len(failed),
                "success_rate": (len(successful) / len(self._requests)) * 100,
                "total_tokens_input": total_input_tokens,
                "total_tokens_output": total_output_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
                "total_cost_usd": total_cost,
                "input_cost_usd": input_cost,
                "output_cost_usd": output_cost,
                "average_latency_ms": avg_latency
            }
    
    def get_stats_by_model(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics broken down by model."""
        with self._lock:
            model_stats = defaultdict(lambda: {
                "requests": 0,
                "tokens_input": 0,
                "tokens_output": 0,
                "tokens_total": 0,
                "cost_usd": 0.0,
                "input_cost_usd": 0.0,
                "output_cost_usd": 0.0,
                "latency_total": 0.0,
                "successful": 0
            })
            
            for request in self._requests:
                stats = model_stats[request.model]
                stats["requests"] += 1
                stats["tokens_input"] += request.input_tokens
                stats["tokens_output"] += request.output_tokens
                stats["tokens_total"] += request.total_tokens
                stats["cost_usd"] += request.cost
                stats["input_cost_usd"] += request.input_cost
                stats["output_cost_usd"] += request.output_cost
                stats["latency_total"] += request.latency_ms
                if request.success:
                    stats["successful"] += 1
            
            # Calculate averages
            result = {}
            for model, stats in model_stats.items():
                result[model] = {
                    "requests": stats["requests"],
                    "tokens_input": stats["tokens_input"],
                    "tokens_output": stats["tokens_output"],
                    "tokens_total": stats["tokens_total"],
                    "cost_usd": stats["cost_usd"],
                    "input_cost_usd": stats["input_cost_usd"],
                    "output_cost_usd": stats["output_cost_usd"],
                    "average_latency_ms": stats["latency_total"] / stats["requests"] if stats["requests"] > 0 else 0,
                    "success_rate": (stats["successful"] / stats["requests"]) * 100 if stats["requests"] > 0 else 0
                }
            
            return result
    
    def get_hourly_breakdown(self, hours: int = DEFAULT_HOURLY_BREAKDOWN_HOURS) -> List[Dict[str, Any]]:
        """
        Get hourly breakdown of requests and costs.
        
        Args:
            hours: Number of hours to include in the breakdown (default: 24)
        
        Returns:
            List of dicts with hourly statistics, most recent first
        """
        with self._lock:
            now = datetime.now()
            hourly_data = []
            
            for i in range(hours):
                hour_start = now - timedelta(hours=i+1)
                hour_end = now - timedelta(hours=i)
                
                hour_requests = [
                    r for r in self._requests
                    if hour_start <= datetime.fromisoformat(r.timestamp) < hour_end
                ]
                
                hourly_data.append({
                    "hour": hour_start.strftime("%Y-%m-%d %H:00"),
                    "requests": len(hour_requests),
                    "cost": sum(r.cost for r in hour_requests)
                })
            
            return list(reversed(hourly_data))  # Most recent first
    
    def get_recent_requests(self, limit: int = DEFAULT_RECENT_REQUESTS_LIMIT) -> List[Dict[str, Any]]:
        """
        Get recent requests with detailed information.
        
        Args:
            limit: Maximum number of recent requests to return (default: 50)
        
        Returns:
            List of request dictionaries, sorted by timestamp (most recent first)
        """
        with self._lock:
            recent = sorted(self._requests, key=lambda r: r.timestamp, reverse=True)[:limit]
            return [asdict(request) for request in recent]
    
    def reset_stats(self):
        """Reset all statistics."""
        with self._lock:
            self._requests.clear()
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics."""
        return {
            "summary": self.get_summary_stats(),
            "by_model": self.get_stats_by_model(),
            "hourly_breakdown": self.get_hourly_breakdown(),
            "recent_requests": self.get_recent_requests()
        }

# Global tracker instance
observability_tracker = ObservabilityTracker()


# --------------------------------------------------
# LiteLLM Callback for Automatic Token Tracking
# --------------------------------------------------
def litellm_success_callback(kwargs, completion_response, start_time, end_time):
    """
    Simple function callback for LiteLLM success events.
    This is called after every successful LLM completion.
    """
    try:
        print(f"[Observability] SUCCESS CALLBACK FIRED!")
        
        # Calculate latency
        latency_ms = (end_time - start_time) * 1000
        
        # Extract model name
        model = kwargs.get("model", "unknown")
        # Clean up model name (remove provider prefix like "azure_ai/")
        if "/" in model:
            model = model.split("/")[-1]
        
        print(f"[Observability] Model: {model}")
        
        # Get real token usage from response
        usage = getattr(completion_response, "usage", None)
        print(f"[Observability] Usage object: {usage}")
        
        if usage:
            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0
            print(f"[Observability] Real tokens - Input: {input_tokens}, Output: {output_tokens}")
        else:
            # Fallback to estimation if usage not available
            messages = kwargs.get("messages", [])
            input_text = " ".join([m.get("content", "") for m in messages if isinstance(m, dict)])
            input_tokens = len(input_text) // 4
            
            response_text = ""
            if hasattr(completion_response, "choices") and completion_response.choices:
                choice = completion_response.choices[0]
                if hasattr(choice, "message") and hasattr(choice.message, "content"):
                    response_text = choice.message.content or ""
            output_tokens = len(response_text) // 4
            print(f"[Observability] Estimated tokens - Input: {input_tokens}, Output: {output_tokens}")
        
        # Try to get cost from LiteLLM
        response_cost = None
        if hasattr(completion_response, "_hidden_params"):
            response_cost = completion_response._hidden_params.get("response_cost")
            print(f"[Observability] LiteLLM response_cost: {response_cost}")
        
        # Track the request
        observability_tracker.track_request(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            success=True,
            error=None,
            user_id=kwargs.get("user", None),
            session_id=None,
            agent_name=None
        )
        
        print(f"[Observability] ✓ Tracked: {model} | {input_tokens} in / {output_tokens} out | {latency_ms:.0f}ms")
        
    except Exception as e:
        print(f"[Observability] Error in success callback: {e}")
        import traceback
        traceback.print_exc()


def litellm_failure_callback(kwargs, completion_response, start_time, end_time):
    """
    Simple function callback for LiteLLM failure events.
    """
    try:
        print(f"[Observability] FAILURE CALLBACK FIRED!")
        
        latency_ms = (end_time - start_time) * 1000
        model = kwargs.get("model", "unknown")
        if "/" in model:
            model = model.split("/")[-1]
        
        error_msg = str(completion_response) if completion_response else "Unknown error"
        
        # Estimate input tokens from messages
        messages = kwargs.get("messages", [])
        input_text = " ".join([m.get("content", "") for m in messages if isinstance(m, dict)])
        input_tokens = len(input_text) // 4
        
        observability_tracker.track_request(
            model=model,
            input_tokens=input_tokens,
            output_tokens=0,
            latency_ms=latency_ms,
            success=False,
            error=error_msg[:500],
            user_id=kwargs.get("user", None),
            session_id=None,
            agent_name=None
        )
        
        print(f"[Observability] ✗ Tracked failure: {model} | {error_msg[:100]}")
        
    except Exception as e:
        print(f"[Observability] Error in failure callback: {e}")


def setup_litellm_observability():
    """
    Set up LiteLLM callbacks for automatic observability tracking.
    Call this once at application startup.
    """
    # Use simple function callbacks (more reliable than class-based)
    # IMPORTANT: All callbacks must be lists, not single functions
    litellm.success_callback = [litellm_success_callback]
    litellm.failure_callback = [litellm_failure_callback]
    
    # input_callback must also be a list
    def input_callback_fn(model, messages, kwargs):
        print(f"[Observability] INPUT CALLBACK: model={model}, messages_count={len(messages) if messages else 0}")
    
    litellm.input_callback = [input_callback_fn]
    
    print("[Observability] LiteLLM callbacks registered:")
    print(f"  - success_callback: {litellm.success_callback}")
    print(f"  - failure_callback: {litellm.failure_callback}")
    print(f"  - input_callback: {litellm.input_callback}")


# Auto-setup on module import
setup_litellm_observability()

def track_llm_request(
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    success: bool,
    error: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    agent_name: Optional[str] = None
):
    """Convenience function to track an LLM request."""
    observability_tracker.track_request(
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        success=success,
        error=error,
        user_id=user_id,
        session_id=session_id,
        agent_name=agent_name
    )

def get_observability_stats() -> Dict[str, Any]:
    """Get all observability statistics."""
    return observability_tracker.get_all_stats()

def reset_observability_stats():
    """Reset all observability statistics."""
    observability_tracker.reset_stats()