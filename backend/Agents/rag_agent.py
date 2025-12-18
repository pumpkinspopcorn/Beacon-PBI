"""
RAG Agent using Google ADK with LiteLLM and Groq API
"""

import os
from typing import List, Optional
from google.adk.agents.llm_agent import LlmAgent
from google.adk.models.lite_llm import LiteLlm

# Global knowledge base
_knowledge_base = []


def create_groq_model(model_name: str = "groq/llama-3.1-8b-instant", max_output_tokens: Optional[int] = None) -> LiteLlm:
    """Create LiteLLM instance configured for Groq with token optimization."""
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError("GROQ_API_KEY environment variable not set")
    
    # Get max_output_tokens from parameter or environment variable
    if max_output_tokens is None:
        max_output_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "1024"))
    
    # LiteLlm automatically uses GROQ_API_KEY from environment
    # Set max_output_tokens to limit response length and optimize token usage
    # Try to pass it as a parameter to LiteLlm constructor
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


def add_to_knowledge_base(documents: List[str]):
    """Add documents to the knowledge base."""
    _knowledge_base.extend(documents)


def retrieve_context(query: str, top_k: int = 3) -> List[str]:
    """Retrieve relevant context from knowledge base."""
    if not _knowledge_base:
        return []
    
    query_terms = query.lower().split()
    scored = [(sum(1 for term in query_terms if term in doc.lower()), doc) for doc in _knowledge_base]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [doc for _, doc in scored[:top_k]]


def create_rag_agent(model_name: str = "groq/llama-3.1-8b-instant", max_output_tokens: Optional[int] = None) -> LlmAgent:
    """Create RAG agent using Google ADK with Groq via LiteLLM."""
    from .cache import before_model_callback, after_model_callback
    
    groq_model = create_groq_model(model_name, max_output_tokens)
    
    instruction = """You are a Retrieval-Augmented Generation agent. 
Retrieve relevant information from the provided context to answer user queries.
Always base your responses on the retrieved context. If context is missing, state that clearly."""
    
    agent = LlmAgent(
        name="RAG",
        description="Handles questions from knowledge bases or documents. Use for internal documentation or stored data queries.",
        model=groq_model,
        instruction=instruction
    )
    
    # Add caching callbacks if supported by ADK
    # This may need adjustment based on actual ADK API
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
        print(f"Warning: Could not set up caching callbacks for RAG agent: {e}")
    
    return agent


if __name__ == "__main__":
    add_to_knowledge_base([
        "RAG stands for Retrieval Augmented Generation.",
        "It combines information retrieval with language generation."
    ])
    agent = create_rag_agent()
    print(f"Created RAG agent: {agent.name}")
