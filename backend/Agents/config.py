import os
from dotenv import load_dotenv

# Load environment variables from the backend directory
# This serves as a fallback in case .env wasn't loaded earlier
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, '.env')

# Load environment variables (override=False means don't overwrite existing env vars)
if os.path.exists(env_path):
    load_dotenv(env_path, override=False)

# Groq Configuration using LiteLLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY

# Groq model name (string) - will be wrapped with LiteLlm in agents
# Using Llama 3.3 70B for better instruction following
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Azure OpenAI Configuration for Embeddings
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = "2024-02-01"

# Azure AI Search Configuration for RAG Agent
AZURE_SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")
AZURE_SEARCH_INDEX = os.getenv("AZURE_SEARCH_INDEX")
AZURE_SEARCH_SEMANTIC_CONFIG = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG")
AZURE_SEARCH_VECTOR_FIELD = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "text_vector")

# Azure AI Search Configuration for Community Agent
AZURE_SEARCH_ENDPOINT_COMM = os.getenv("AZURE_SEARCH_ENDPOINT_COMM")
AZURE_SEARCH_KEY_COMM = os.getenv("AZURE_SEARCH_KEY_COMM")
AZURE_SEARCH_INDEX_COMM = os.getenv("AZURE_SEARCH_INDEX_COMM")
AZURE_SEARCH_SEMANTIC_CONFIG_COMM = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG_COMM")

# Set environment variables for LangChain retrievers
if AZURE_SEARCH_KEY:
    os.environ["AZURE_AI_SEARCH_API_KEY"] = AZURE_SEARCH_KEY
if AZURE_OPENAI_KEY:
    os.environ["AZURE_OPENAI_API_KEY"] = AZURE_OPENAI_KEY
