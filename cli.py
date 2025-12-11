import sys
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.orchestrator import orchestrator
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Initialize session service and runner
session_service = InMemorySessionService()
runner = Runner(
    agent=orchestrator,
    app_name=orchestrator.name,
    session_service=session_service,
)

# Session IDs for continuous conversation
USER_ID = "cli_user"
SESSION_ID = "cli_session"

async def initialize_session():
    """Initialize the session for the CLI."""
    await session_service.create_session(
        app_name=orchestrator.name,
        user_id=USER_ID,
        session_id=SESSION_ID
    )

async def ask_orchestrator(query: str) -> str:
    """
    Send a query to the orchestrator and get the response.
    
    Args:
        query: User's question
        
    Returns:
        str: Orchestrator's response
    """
    # Create message content
    message = types.Content(
        role='user',
        parts=[types.Part(text=query)]
    )
    
    # Run the agent and collect response
    response_text = ""
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=SESSION_ID,
        new_message=message,
    ):
        # Collect final response
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, 'text') and part.text:
                    response_text += part.text
    
    return response_text

async def main_async():
    """Async main function for the CLI."""
    print("=" * 60)
    print("🎉 Welcome to PBI Beacon CLI!")
    print("=" * 60)
    print("\nPowered by Google ADK with:")
    print("  • InternetAgent - Real-time web search (DuckDuckGo)")
    print("  • RAGAgent - Internal knowledge base (Azure AI Search)")
    print("  • Orchestrator - Intelligent query routing")
    print("\nType 'exit' or 'quit' to stop.")
    print("-" * 60)
    
    # Initialize session
    try:
        await initialize_session()
        print("✓ Session initialized\n")
    except Exception as e:
        print(f"✗ Error initializing session: {e}\n")
        return

    while True:
        try:
            user_input = input("\n🙋 You: ")
            
            if user_input.lower() in ["exit", "quit"]:
                print("\n👋 Goodbye!")
                break
            
            if not user_input.strip():
                continue

            print("\n🤖 Orchestrator: Thinking...", end="", flush=True)
            
            # Get response from orchestrator
            response = await ask_orchestrator(user_input)
            
            print(f"\r🤖 Orchestrator: {response}\n")
            print("-" * 60)
            
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n\n✗ Error: {e}")
            import traceback
            traceback.print_exc()

def main():
    """Entry point for the CLI."""
    # Run the async main function
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
