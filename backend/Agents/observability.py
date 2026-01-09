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
        
        # Token pricing per model (USD per 1M tokens)
        # Updated pricing as of 2025
        self._pricing = {
            # Azure Grok models (xAI on Azure)
            "grok-3-mini": {
                "input": 0.30,       # Estimated pricing
                "output": 0.50       # Estimated pricing
            },
            "grok-3": {
                "input": 3.00,       # Estimated pricing
                "output": 15.00      # Estimated pricing
            },
            # Gemini models
            "gemini-1.5-flash": {
                "input": 0.075,      # $0.075 per 1M input tokens
                "output": 0.30       # $0.30 per 1M output tokens
            },
            "gemini-1.5-pro": {
                "input": 1.25,       # $1.25 per 1M input tokens
                "output": 5.00       # $5.00 per 1M output tokens
            },
            "gemini-2.0-flash": {
                "input": 0.10,       # $0.10 per 1M input tokens
                "output": 0.40       # $0.40 per 1M output tokens
            },
            # Azure OpenAI models
            "gpt-4o": {
                "input": 2.50,       # $2.50 per 1M input tokens
                "output": 10.00      # $10.00 per 1M output tokens
            },
            "gpt-4o-mini": {
                "input": 0.15,       # $0.15 per 1M input tokens
                "output": 0.60       # $0.60 per 1M output tokens
            },
            "gpt-4-turbo": {
                "input": 10.00,      # $10.00 per 1M input tokens
                "output": 30.00      # $30.00 per 1M output tokens
            },
            # Llama models (if using via other providers)
            "llama-3.3-70b-versatile": {
                "input": 0.59,       # $0.59 per 1M input tokens
                "output": 0.79       # $0.79 per 1M output tokens
            },
            "llama-3.1-8b-instant": {
                "input": 0.05,       # $0.05 per 1M input tokens
                "output": 0.08       # $0.08 per 1M output tokens
            }
        }
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> tuple[float, float, float]:
        """Calculate cost for a request based on model and token usage.
        Pricing is in USD per 1M tokens.
        Returns: (total_cost, input_cost, output_cost)
        """
        # First try LiteLLM's cost_per_token for accurate pricing
        try:
            input_cost_per_token, output_cost_per_token = litellm.cost_per_token(
                model=model, 
                prompt_tokens=input_tokens, 
                completion_tokens=output_tokens
            )
            input_cost = input_cost_per_token
            output_cost = output_cost_per_token
            print(f"[Observability] Using LiteLLM pricing for {model}: ${input_cost:.6f} in / ${output_cost:.6f} out")
            return (input_cost + output_cost, input_cost, output_cost)
        except Exception as e:
            print(f"[Observability] LiteLLM pricing not available for {model}, using local pricing: {e}")
        
        # Fallback to local pricing table
        pricing = None
        model_lower = model.lower()
        
        for price_model, price_data in self._pricing.items():
            if price_model.lower() in model_lower or model_lower in price_model.lower():
                pricing = price_data
                break
        
        if pricing is None:
            # Default pricing for unknown models (conservative estimate)
            input_cost = (input_tokens / 1_000_000) * 0.50   # $0.50 per 1M
            output_cost = (output_tokens / 1_000_000) * 1.50  # $1.50 per 1M
            return (input_cost + output_cost, input_cost, output_cost)
        
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
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