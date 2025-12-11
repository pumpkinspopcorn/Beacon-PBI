import os
from google.adk.models.lite_llm import LiteLlm

def get_model(model_id: str = "groq/moonshotai/kimi-k2-instruct-0905"):
    """
    Returns a Google ADK Model instance using Groq via LiteLLM.
    Simple setup - just model ID, LiteLLM handles the rest.
    
    Args:
        model_id: The Groq model to use. Format: "groq/<provider>/<model-name>"
                  Default: "groq/moonshotai/kimi-k2-instruct-0905"
    
    Returns:
        LiteLlm: A Google ADK compatible model instance using Groq.
    
    Note:
        - Requires GROQ_API_KEY environment variable to be set
        - LiteLLM automatically handles Groq API routing
        - Just like the old Agno version: simple model ID, that's it!
    """
    # LiteLLM will auto-detect GROQ_API_KEY from environment
    return LiteLlm(model=model_id)

