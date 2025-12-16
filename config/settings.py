import os

class Settings:
    # Azure OpenAI Configuration
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_KEY_GPT = os.getenv("AZURE_OPENAI_KEY_GPT")
    AZURE_OPENAI_KEY_EMBED = os.getenv("AZURE_OPENAI_KEY_EMBED")
    AZURE_OPENAI_GPT_DEPLOYMENT = os.getenv("AZURE_OPENAI_GPT_DEPLOYMENT", "gpt-4.1-mini")
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002")
    
    # Legacy LLM Configuration (kept for backward compatibility)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    
    # Vector DB Configuration (RAG Agent - Internal docs)
    AZURE_SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
    AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY")
    AZURE_SEARCH_INDEX = os.getenv("AZURE_SEARCH_INDEX")
    AZURE_SEARCH_SEMANTIC_CONFIG = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG")
    
    # Community Q&A Configuration (Community Agent - Stack Overflow)
    AZURE_SEARCH_INDEX_COMMUNITY = os.getenv("AZURE_SEARCH_INDEX_COMMUNITY")
    AZURE_SEARCH_SEMANTIC_CONFIG_COMMUNITY = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG_COMMUNITY")
    
    # Search Configuration
    BING_SEARCH_API_KEY = os.getenv("BING_SEARCH_API_KEY")

settings = Settings()

