import os
from agno.models.groq import Groq

def get_model(model_id: str = "moonshotai/kimi-k2-instruct-0905"):
    """
    Returns an Agno Model instance using Groq with the specified model.
    """
    # Using Groq as requested by the user
    # API key is expected to be in GROQ_API_KEY environment variable
    return Groq(id=model_id)
