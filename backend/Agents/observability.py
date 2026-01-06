"""
Observability tracking for LLM usage, token consumption, and costs.
Integrates with Google's ADK for comprehensive monitoring.
"""

import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
import threading

@dataclass
class LLMRequest:
    """Represents a single LLM request with all relevant metrics."""
    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost: float
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
        
        # Token pricing per model (USD per 1K tokens)
        # Based on Google AI pricing as of 2024
        self._pricing = {
            "gemini-1.5-flash": {
                "input": 0.000075,   # $0.075 per 1M input tokens
                "output": 0.0003     # $0.30 per 1M output tokens
            },
            "gemini-1.5-pro": {
                "input": 0.00125,    # $1.25 per 1M input tokens
                "output": 0.005      # $5.00 per 1M output tokens
            },
            "gemini-1.0-pro": {
                "input": 0.0005,     # $0.50 per 1M input tokens
                "output": 0.0015     # $1.50 per 1M output tokens
            },
            # Groq pricing (if using Groq models)
            "llama-3.1-70b-versatile": {
                "input": 0.00059,    # $0.59 per 1M input tokens
                "output": 0.00079    # $0.79 per 1M output tokens
            },
            "llama-3.1-8b-instant": {
                "input": 0.00005,    # $0.05 per 1M input tokens
                "output": 0.00008    # $0.08 per 1M output tokens
            },
            "mixtral-8x7b-32768": {
                "input": 0.00024,    # $0.24 per 1M input tokens
                "output": 0.00024    # $0.24 per 1M output tokens
            }
        }
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost for a request based on model and token usage."""
        if model not in self._pricing:
            # Default pricing for unknown models
            return (input_tokens * 0.001 + output_tokens * 0.002) / 1000
        
        pricing = self._pricing[model]
        input_cost = (input_tokens / 1000000) * pricing["input"]
        output_cost = (output_tokens / 1000000) * pricing["output"]
        return input_cost + output_cost
    
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
        cost = self.calculate_cost(model, input_tokens, output_tokens)
        
        request = LLMRequest(
            timestamp=datetime.now().isoformat(),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost=cost,
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
                    "average_latency_ms": 0.0
                }
            
            successful = [r for r in self._requests if r.success]
            failed = [r for r in self._requests if not r.success]
            
            total_input_tokens = sum(r.input_tokens for r in self._requests)
            total_output_tokens = sum(r.output_tokens for r in self._requests)
            total_cost = sum(r.cost for r in self._requests)
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