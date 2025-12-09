import sys
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.orchestrator import orchestrator

def main():
    print("Welcome to PBI Beacon CLI!")
    print("Type 'exit' or 'quit' to stop.")
    print("-" * 50)

    while True:
        try:
            user_input = input("\nYou: ")
            if user_input.lower() in ["exit", "quit"]:
                print("Goodbye!")
                break
            
            if not user_input.strip():
                continue

            print("\nOrchestrator: Thinking...", end="", flush=True)
            response = orchestrator.run(user_input)
            print(f"\rOrchestrator: {response.content}")
            
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")

if __name__ == "__main__":
    main()

