import os
from google.adk.models.lite_llm import LiteLlm

# Azure OpenAI Configuration
# Support both AZURE_OPENAI_KEY_GPT and AZURE_OPENAI_KEY for flexibility
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY_GPT = os.getenv("AZURE_OPENAI_KEY_GPT") or os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_GPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_GPT_DEPLOYMENT", "gpt-4.1-mini")

# Build Azure OpenAI model identifier for LiteLLM
# Format: azure/{deployment_name}
# LiteLLM requires AZURE_API_KEY and AZURE_API_BASE to be set for Azure OpenAI
DEFAULT_MODEL = f"azure/{AZURE_OPENAI_GPT_DEPLOYMENT}" if AZURE_OPENAI_GPT_DEPLOYMENT else None

def get_model(model_id: str = None, max_tokens: int = 2048):
    """
    Returns a Google ADK Model instance using Azure OpenAI via LiteLLM.
    
    Args:
        model_id: The Azure OpenAI model to use. If None, uses DEFAULT_MODEL.
                  Can be overridden with LLM_MODEL environment variable.
        max_tokens: Maximum tokens to generate in response. Default: 2048.
    
    Returns:
        LiteLlm: A Google ADK compatible model instance using Azure OpenAI.
    
    Note:
        - Requires AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY_GPT, and 
          AZURE_OPENAI_GPT_DEPLOYMENT environment variables to be set
        - LiteLLM automatically handles Azure OpenAI API routing
        - Uses the deployment name specified in AZURE_OPENAI_GPT_DEPLOYMENT
    """
    # Check if Azure OpenAI configuration is available
    if not all([AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY_GPT, AZURE_OPENAI_GPT_DEPLOYMENT]):
        raise ValueError(
            "Azure OpenAI configuration missing. Please set:\n"
            "  - AZURE_OPENAI_ENDPOINT\n"
            "  - AZURE_OPENAI_KEY_GPT\n"
            "  - AZURE_OPENAI_GPT_DEPLOYMENT"
        )
    
    # Set environment variables that LiteLLM expects for Azure OpenAI
    # LiteLLM looks for AZURE_API_KEY and AZURE_API_BASE when using azure/ prefix
    os.environ["AZURE_API_KEY"] = AZURE_OPENAI_KEY_GPT
    os.environ["AZURE_API_BASE"] = AZURE_OPENAI_ENDPOINT.rstrip('/')
    
    # Use provided model_id or default to Azure OpenAI deployment
    if model_id:
        model = model_id
    elif DEFAULT_MODEL:
        model = DEFAULT_MODEL
    else:
        raise ValueError("No model specified and AZURE_OPENAI_GPT_DEPLOYMENT not set")
    
    print(f"🤖 Using model: {model} (max_tokens: {max_tokens})")
    print(f"   Endpoint: {AZURE_OPENAI_ENDPOINT}")
    print(f"   Deployment: {AZURE_OPENAI_GPT_DEPLOYMENT}")
    
    # Configure LiteLLM for Azure OpenAI
    # Model format: azure/{deployment_name}
    # LiteLLM will use AZURE_API_KEY and AZURE_API_BASE from environment
    # Azure OpenAI uses max_tokens, not max_output_tokens
    return LiteLlm(
        model=model,
        extra_body={"max_tokens": max_tokens}  # Azure OpenAI expects max_tokens in extra_body
    )

