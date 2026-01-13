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
        self._requests: List[LLMRequest] = []
        self._lock = threading.Lock()
        
        # Dynamic pricing cache (fetched from LiteLLM or web sources)
        # Format: {model_name: {"input": price_per_1M, "output": price_per_1M, "last_updated": timestamp}}
        self._pricing_cache: Dict[str, Dict[str, Any]] = {}
        self._pricing_cache_lock = threading.Lock()
    
    def _fetch_pricing_from_web(self, model: str) -> Optional[Dict[str, float]]:
        """
        Fetch latest pricing from web sources as a last resort.
        Returns: {"input": price_per_1M, "output": price_per_1M} or None
        """
        try:
            import requests
            from datetime import datetime
            
            # Try langcopilot.com API (they have structured pricing data)
            model_slug = model.lower().replace("/", "-").replace("_", "-")
            url = f"https://www.langcopilot.com/llm-pricing/openai/{model_slug}"
            
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                # Parse the HTML for pricing (basic extraction)
                text = response.text
                if "per 1M input tokens" in text and "per 1M output tokens" in text:
                    # This is a simplified parser - in production you'd want proper HTML parsing
                    import re
                    input_match = re.search(r'\$(\d+\.?\d*)\s*(?:/\s*)?(?:per\s*)?1M input tokens', text)
                    output_match = re.search(r'\$(\d+\.?\d*)\s*(?:/\s*)?(?:per\s*)?1M output tokens', text)
                    
                    if input_match and output_match:
                        pricing = {
                            "input": float(input_match.group(1)),
                            "output": float(output_match.group(1)),
                            "last_updated": datetime.now().isoformat(),
                            "source": "web"
                        }
                        print(f"[Observability] Fetched pricing from web for {model}: ${pricing['input']:.2f}/${pricing['output']:.2f} per 1M tokens")
                        return pricing
        except Exception as e:
            print(f"[Observability] Failed to fetch pricing from web for {model}: {e}")
        
        return None
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> tuple[float, float, float]:
        """Calculate cost for a request based on model and token usage.
        Pricing is dynamically fetched from LiteLLM's database or web sources.
        Returns: (total_cost, input_cost, output_cost)
        """
        # Strategy 1: Try LiteLLM's cost_per_token (most reliable, updated with package)
        try:
            input_cost_per_token, output_cost_per_token = litellm.cost_per_token(
                model=model, 
                prompt_tokens=input_tokens, 
                completion_tokens=output_tokens
            )
            input_cost = input_cost_per_token
            output_cost = output_cost_per_token
            print(f"[Observability] ✓ Using LiteLLM pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
            return (input_cost + output_cost, input_cost, output_cost)
        except Exception as e:
            print(f"[Observability] LiteLLM pricing not available for {model}: {e}")
        
        # Strategy 2: Check cache for previously fetched pricing
        with self._pricing_cache_lock:
            if model in self._pricing_cache:
                cached = self._pricing_cache[model]
                # Use cached pricing (consider adding expiry check here if needed)
                input_cost = (input_tokens / 1_000_000) * cached["input"]
                output_cost = (output_tokens / 1_000_000) * cached["output"]
                print(f"[Observability] ✓ Using cached pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
                return (input_cost + output_cost, input_cost, output_cost)
        
        # Strategy 3: Try fetching from web
        web_pricing = self._fetch_pricing_from_web(model)
        if web_pricing:
            # Cache it for future use
            with self._pricing_cache_lock:
                self._pricing_cache[model] = web_pricing
            
            input_cost = (input_tokens / 1_000_000) * web_pricing["input"]
            output_cost = (output_tokens / 1_000_000) * web_pricing["output"]
            print(f"[Observability] ✓ Using web-fetched pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
            return (input_cost + output_cost, input_cost, output_cost)
        
        # Strategy 4: Conservative fallback estimate (warn user)
        print(f"[Observability] ⚠️  WARNING: No pricing data found for {model}. Using conservative estimate.")
        print(f"[Observability] ⚠️  Please update LiteLLM package: pip install --upgrade litellm")
        input_cost = (input_tokens / 1_000_000) * 2.00   # Conservative: GPT-4 class pricing
        output_cost = (output_tokens / 1_000_000) * 8.00  # Conservative: GPT-4 class pricing
        return (input_cost + output_cost, input_cost, output_cost)
    
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
    
    def get_hourly_breakdown(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get hourly breakdown of requests and costs."""
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
    
    def get_recent_requests(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent requests with detailed information."""
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