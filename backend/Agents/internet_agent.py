"""
Internet Agent using Google ADK with LiteLLM and Groq API
Enhanced with DuckDuckGo search tool
"""

import os
from typing import Optional
from google.adk.agents.llm_agent import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from langchain_community.tools import DuckDuckGoSearchRun
from .search_utils import SearchResult

# Global store for search results (shared with API)
_internet_agent_search_store: dict[str, list[SearchResult]] = {}


def get_search_results_for_session(session_id: str) -> list[SearchResult]:
    """Get stored search results for a session. Called by API."""
    return _internet_agent_search_store.get(session_id, [])


def create_groq_model(model_name: str = "groq/llama-3.1-8b-instant", max_output_tokens: Optional[int] = None) -> LiteLlm:
    """Create LiteLLM instance configured for Groq with token optimization."""
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError("GROQ_API_KEY environment variable not set")
    
    # Get max_output_tokens from parameter or environment variable
    if max_output_tokens is None:
        max_output_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "1024"))
    
    # LiteLlm automatically uses GROQ_API_KEY from environment
    # Set max_output_tokens to limit response length and optimize token usage
    try:
        # Try passing max_output_tokens as a parameter
        model = LiteLlm(model=model_name, max_output_tokens=max_output_tokens)
    except TypeError:
        # If not supported, create model and try to set it as attribute
        model = LiteLlm(model=model_name)
        if hasattr(model, 'max_output_tokens'):
            model.max_output_tokens = max_output_tokens
        elif hasattr(model, 'config'):
            if hasattr(model.config, 'max_output_tokens'):
                model.config.max_output_tokens = max_output_tokens
    
    return model


def create_internet_agent(model_name: str = "groq/llama-3.1-8b-instant", max_output_tokens: Optional[int] = None) -> LlmAgent:
    """Create Internet agent with DuckDuckGo search tool."""
    from .cache import before_model_callback, after_model_callback
    
    groq_model = create_groq_model(model_name, max_output_tokens)
    
    # Create DuckDuckGo search tool
    search_tool = DuckDuckGoSearchRun()
    
    instruction = """You are an Internet agent with access to DuckDuckGo web search.
When answering user queries:
1. Use the search tool to find current information from the web
2. Always cite your sources with the URLs from search results
3. Indicate when information might be outdated
4. Format your response clearly and include source citations"""
    
    # Add tools parameter if Google ADK supports it
    try:
        agent = LlmAgent(
            name="Internet",
            description="Handles questions requiring current web information or real-time data. Use for recent events or external sources.",
            model=groq_model,
            instruction=instruction,
            tools=[search_tool]
        )
    except TypeError:
        # If tools parameter not supported, create without it
        agent = LlmAgent(
            name="Internet",
            description="Handles questions requiring current web information or real-time data. Use for recent events or external sources.",
            model=groq_model,
            instruction=instruction
        )
    
    # Add caching callbacks if supported by ADK
    try:
        if hasattr(agent, 'before_model_callback'):
            agent.before_model_callback = before_model_callback
        if hasattr(agent, 'after_model_callback'):
            agent.after_model_callback = after_model_callback
        elif hasattr(agent, 'callbacks'):
            agent.callbacks = {
                'before_model': before_model_callback,
                'after_model': after_model_callback
            }
    except Exception as e:
        print(f"Warning: Could not set up caching callbacks for Internet agent: {e}")
    
    return agent


if __name__ == "__main__":
    agent = create_internet_agent()
    print(f"Created Internet agent: {agent.name}")
