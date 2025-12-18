"""
Coordinator/Dispatcher Agent using Google ADK with LiteLLM and Groq API
Following Google ADK Coordinator/Dispatcher Pattern
"""

import os
from typing import Optional
from google.adk.agents.llm_agent import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from .rag_agent import create_rag_agent, add_to_knowledge_base
from .internet_agent import create_internet_agent


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


def create_manager_agent(model_name: str = "groq/llama-3.1-8b-instant", max_output_tokens: Optional[int] = None) -> LlmAgent:
    """
    Create Manager/Coordinator agent using Google ADK with sub-agents.
    
    This follows the Google ADK Coordinator/Dispatcher Pattern:
    - Coordinator manages several specialized sub_agents
    - Routes incoming requests using LLM-Driven Delegation
    - Uses sub_agents list (following Google ADK pattern)
    """
    from .cache import before_model_callback, after_model_callback
    
    # Create Groq model instance with token optimization
    groq_model = create_groq_model(model_name, max_output_tokens)
    
    # Create sub-agents (following Google ADK pattern) with token optimization
    rag_agent = create_rag_agent(model_name, max_output_tokens)
    internet_agent = create_internet_agent(model_name, max_output_tokens)
    
    # Coordinator instruction following Google ADK Coordinator/Dispatcher pattern
    instruction = """You are a friendly and helpful Power BI assistant coordinator. Your primary goal is to fully understand and satisfy the customer's needs. Your role is to:

1. Always be polite, professional, and user-friendly in your responses
2. Answer basic questions, greetings, and simple queries yourself directly
3. Only route to specialist agents when the question requires specialized knowledge:
   - Use RAG agent for questions about knowledge bases, internal documentation, stored data, or when searching through specific documents
   - Use Internet agent for questions requiring current web information, real-time data, recent events, or external sources
4. For greetings like "Hello" or "Hi", respond warmly and introduce yourself
5. Always ask follow-up questions to better understand the customer's needs:
   - If a question is unclear, ask for clarification
   - If you need more details to provide a complete answer, ask specific follow-up questions
   - If the customer mentions an issue, ask about the specific symptoms, context, or error messages
   - If they need help with DAX, ask about their data structure, requirements, or sample data
6. Never assume - always ask for clarification when needed
7. Your goal is to ensure the customer's issue is fully resolved and they are satisfied with the solution
8. Only transfer to sub-agents when you cannot answer the question yourself or when specialized knowledge is required"""
    
    # Create coordinator agent with sub_agents (Google ADK pattern)
    # allow_transfer=True is often implicit with sub_agents in AutoFlow
    coordinator = LlmAgent(
        name="HelpDeskCoordinator",
        description="Main help desk router that coordinates between specialist agents.",
        model=groq_model,
        instruction=instruction,
        sub_agents=[rag_agent, internet_agent]  # Google ADK Coordinator pattern
    )
    
    # Add caching callbacks if supported by ADK
    try:
        if hasattr(coordinator, 'before_model_callback'):
            coordinator.before_model_callback = before_model_callback
        if hasattr(coordinator, 'after_model_callback'):
            coordinator.after_model_callback = after_model_callback
        elif hasattr(coordinator, 'callbacks'):
            coordinator.callbacks = {
                'before_model': before_model_callback,
                'after_model': after_model_callback
            }
    except Exception as e:
        print(f"Warning: Could not set up caching callbacks for coordinator: {e}")
    
    return coordinator


if __name__ == "__main__":
    # Ensure GROQ_API_KEY is set
    if not os.getenv("GROQ_API_KEY"):
        print("Warning: GROQ_API_KEY not set")
    
    # Create coordinator agent (following Google ADK pattern)
    coordinator = create_manager_agent()
    print(f"Created Coordinator: {coordinator.name}")
    print(f"Sub-agents: {[agent.name for agent in coordinator.sub_agents]}")
    
    # Example: Add to knowledge base
    add_to_knowledge_base(["RAG combines retrieval with generation."])
    print("\nKnowledge base updated.")
