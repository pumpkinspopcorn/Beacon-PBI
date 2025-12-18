"""
Caching layer for ADK agents using before_model_callback plugin system.
Prevents redundant LLM calls for repeated queries or static prompt data.
"""

import hashlib
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os

# In-memory cache (can be replaced with Redis or other persistent storage)
_cache: Dict[str, Dict[str, Any]] = {}

# Cache configuration
CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "24"))  # Default 24 hours
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"


def _generate_cache_key(prompt: str, model_name: str, config: Optional[Dict] = None) -> str:
    """Generate a unique cache key from prompt, model, and config."""
    # Normalize the input
    cache_data = {
        "prompt": prompt.strip().lower(),
        "model": model_name,
        "config": config or {}
    }
    # Create hash of the cache data
    cache_str = json.dumps(cache_data, sort_keys=True)
    return hashlib.sha256(cache_str.encode()).hexdigest()


def get_cached_response(cache_key: str) -> Optional[Any]:
    """Retrieve cached response if it exists and hasn't expired."""
    if not CACHE_ENABLED:
        return None
    
    if cache_key not in _cache:
        return None
    
    cached_item = _cache[cache_key]
    cached_time = cached_item.get("timestamp")
    
    if not cached_time:
        # Invalid cache entry, remove it
        del _cache[cache_key]
        return None
    
    # Check if cache has expired
    if datetime.now() - cached_time > timedelta(hours=CACHE_TTL_HOURS):
        del _cache[cache_key]
        return None
    
    return cached_item.get("response")


def set_cached_response(cache_key: str, response: Any):
    """Store response in cache with timestamp."""
    if not CACHE_ENABLED:
        return
    
    _cache[cache_key] = {
        "response": response,
        "timestamp": datetime.now()
    }


def clear_cache():
    """Clear all cached responses."""
    global _cache
    _cache = {}


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return {
        "enabled": CACHE_ENABLED,
        "size": len(_cache),
        "ttl_hours": CACHE_TTL_HOURS
    }


async def before_model_callback(callback_context: Any, llm_request: Any) -> Optional[Any]:
    """
    ADK before_model_callback function to check cache before making LLM calls.
    
    This function is called before each model invocation. If a cached response
    exists for the same query, it returns the cached response, preventing
    redundant LLM calls.
    
    Args:
        callback_context: ADK callback context
        llm_request: The LLM request object containing prompt and model info
    
    Returns:
        Cached response if available, None to proceed with model call
    """
    if not CACHE_ENABLED:
        return None
    
    try:
        # Extract prompt and model information from llm_request
        # The exact structure depends on ADK's implementation
        prompt = None
        model_name = None
        config = None
        
        # Try to extract information from llm_request
        # This may need adjustment based on actual ADK structure
        if hasattr(llm_request, 'prompt'):
            prompt = llm_request.prompt
        elif hasattr(llm_request, 'messages'):
            # Extract text from messages
            messages = llm_request.messages
            if messages and len(messages) > 0:
                last_message = messages[-1]
                if hasattr(last_message, 'content'):
                    prompt = last_message.content
                elif isinstance(last_message, dict) and 'content' in last_message:
                    prompt = last_message['content']
        
        if hasattr(llm_request, 'model'):
            model_name = llm_request.model
        elif hasattr(llm_request, 'model_name'):
            model_name = llm_request.model_name
        
        if hasattr(llm_request, 'config'):
            config = llm_request.config
        
        if not prompt or not model_name:
            # Can't generate cache key, proceed with model call
            return None
        
        # Generate cache key
        cache_key = _generate_cache_key(prompt, model_name, config)
        
        # Check cache
        cached_response = get_cached_response(cache_key)
        if cached_response is not None:
            # Return cached response - this will prevent the model call
            # The exact return format depends on ADK's expected response format
            # This may need to be adjusted based on ADK documentation
            return cached_response
        
        # No cache hit, proceed with model call
        return None
        
    except Exception as e:
        # Log error but don't break the flow
        print(f"Cache callback error: {e}")
        return None


async def after_model_callback(callback_context: Any, llm_request: Any, llm_response: Any):
    """
    ADK after_model_callback function to cache responses after model calls.
    
    This function is called after each model invocation to store the response
    in cache for future use.
    
    Args:
        callback_context: ADK callback context
        llm_request: The LLM request object
        llm_response: The LLM response object
    """
    if not CACHE_ENABLED:
        return
    
    try:
        # Extract prompt and model information (same as before_model_callback)
        prompt = None
        model_name = None
        config = None
        
        if hasattr(llm_request, 'prompt'):
            prompt = llm_request.prompt
        elif hasattr(llm_request, 'messages'):
            messages = llm_request.messages
            if messages and len(messages) > 0:
                last_message = messages[-1]
                if hasattr(last_message, 'content'):
                    prompt = last_message.content
                elif isinstance(last_message, dict) and 'content' in last_message:
                    prompt = last_message['content']
        
        if hasattr(llm_request, 'model'):
            model_name = llm_request.model
        elif hasattr(llm_request, 'model_name'):
            model_name = llm_request.model_name
        
        if hasattr(llm_request, 'config'):
            config = llm_request.config
        
        if not prompt or not model_name:
            return
        
        # Extract response content
        response_content = None
        if hasattr(llm_response, 'content'):
            response_content = llm_response.content
        elif hasattr(llm_response, 'text'):
            response_content = llm_response.text
        elif isinstance(llm_response, dict):
            response_content = llm_response.get('content') or llm_response.get('text')
        
        if not response_content:
            return
        
        # Generate cache key and store response
        cache_key = _generate_cache_key(prompt, model_name, config)
        set_cached_response(cache_key, response_content)
        
    except Exception as e:
        # Log error but don't break the flow
        print(f"Cache callback error (after): {e}")

