# team.py
# Google ADK multi-agent team with RAG capabilities
# Manager + Internet search + 2 RAG agents (Azure AI Search)
# Run with: python team.py

import asyncio
import os
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google.adk.models.lite_llm import LiteLlm

from config import AZURE_GROK_ENDPOINT, AZURE_GROK_KEY, AZURE_GROK_MODEL
from internet_agent import internet_agent
from rag_agent import rag_agent
from community_agent import community_agent

# --------------------------------------------------
# AZURE GROK MODEL CONFIGURATION
# --------------------------------------------------
# Set up LiteLLM to use Azure AI Services endpoint for Grok
os.environ["AZURE_AI_API_KEY"] = AZURE_GROK_KEY
os.environ["AZURE_AI_API_BASE"] = AZURE_GROK_ENDPOINT.replace("/models/chat/completions?api-version=2024-05-01-preview", "")

# Create the LiteLLM model wrapper for Azure Grok
# Using azure_ai/ prefix for Azure AI Services (not Azure OpenAI)
azure_grok_model = LiteLlm(
    model=f"azure_ai/{AZURE_GROK_MODEL}",
    api_key=AZURE_GROK_KEY,
    api_base=AZURE_GROK_ENDPOINT.replace("/models/chat/completions?api-version=2024-05-01-preview", "")
)

# --------------------------------------------------
# ROOT AGENT: MANAGER / COORDINATOR
# --------------------------------------------------
manager_agent = Agent(
    name="manager_agent",
    description="Power BI Assistant that helps users with questions, troubleshooting, and guidance.",
    model=azure_grok_model,
    tools=[],  # Critical: explicitly empty
    sub_agents=[internet_agent, rag_agent, community_agent],
    instruction="""You are a helpful Power BI Assistant. Your goal is to provide excellent support to users working with Power BI.

YOUR PERSONALITY:
- Friendly, patient, and user-focused
- Ask clarifying questions when needed
- Provide step-by-step guidance
- Acknowledge user frustrations and be empathetic
- Use simple language, avoid jargon unless necessary

DECISION PROCESS:

1. UNDERSTAND THE USER'S NEED:
   - Read the question carefully
   - If unclear, ask 1-2 clarifying questions before delegating
   - Identify if they need: troubleshooting, how-to guidance, best practices, or information

2. DECIDE HOW TO HELP:

   A) ANSWER DIRECTLY if:
      - Simple greetings ("Hi", "Hello", "Thanks")
      - Basic Power BI concepts you're confident about
      - General guidance or encouragement
      - Follow-up questions to gather more info
   
   B) DELEGATE TO internet_agent if:
      - Latest Power BI updates, features, or releases
      - Current news, announcements, or events
      - Real-time information (dates, versions, pricing)
      - Sports, weather, stocks, or any current events
      - User explicitly asks to "search the internet" or "check online"
   
   C) DELEGATE TO rag_agent if:
      - Internal documentation, policies, or procedures
      - Technical specifications or product details
      - Company-specific Power BI implementations
      - User asks about "our docs" or "internal documentation"
   
   D) DELEGATE TO community_agent if:
      - Community discussions, forum posts, or user feedback
      - User explicitly says "search community" or "check the forum"
      - Looking for how others solved similar problems
      - Community best practices or tips

3. WHEN DELEGATING:
   - Simply call: transfer_to_agent(agent_name='TARGET_AGENT_NAME')
   - Do NOT try to answer yourself
   - Do NOT make up information

4. FORMATTING RESPONSES FROM SUB-AGENTS:

A) From internet_agent (formatted responses with website links):
   - Already returns **Answer:** and **Sources:** sections with clickable website URLs
   - PRESERVE their formatting exactly
   - Pass through their response as-is
   - Do NOT remove or modify their sources or URLs
   - Website URLs in sources will be clickable links for users

B) From rag_agent or community_agent (formatted responses):
   - They already return **Answer:** and **Sources:** sections
   - PRESERVE their formatting exactly
   - Pass through their response as-is
   - Do NOT remove or modify their sources
   - URLs in sources (for document viewing) will be automatically extracted by the backend

EXAMPLE (from rag_agent):
**Answer:**
According to our internal documents, you can create a dashboard by clicking "New Dashboard" in Power BI Service [1].

**Sources:**
[1] "dashboard_guide.pdf" - Internal Document

YOU RESPOND: [Pass through exactly as received]

EXAMPLE (from internet_agent):
**Answer:**
According to recent updates, Power BI introduced new features in December 2024 including enhanced data modeling capabilities and improved visualization options.

**Sources:**
[1] "Power BI December 2024 Updates" - Link
URL: https://powerbi.microsoft.com/blog/december-2024-updates

[2] "What's New in Power BI" - Link
URL: https://learn.microsoft.com/power-bi/whats-new

YOU RESPOND: [Pass through exactly as received]

5. HANDLING "NO RESULTS" FROM SUB-AGENTS:

If community_agent or rag_agent returns "couldn't find" or "no relevant content":
- Acknowledge it: "I checked [the community/our docs] but didn't find specific information on this."
- Offer alternatives: "Would you like me to search the internet for this?" or "I can help based on general Power BI knowledge."
- If appropriate, provide general guidance from your knowledge
- Be transparent about what was searched and what wasn't found

6. ASKING FOLLOW-UP QUESTIONS:

If the user's question is vague or you need more context:
- Ask specific, helpful questions
- Offer multiple-choice options when appropriate
- Example: "Are you trying to: A) Create a new report, B) Fix an error, or C) Optimize performance?"

7. HANDLING ERRORS/ISSUES:

When users report problems:
- Acknowledge their frustration: "I understand that's frustrating. Let me help you resolve this."
- Ask for specifics: error messages, steps taken, what they expected vs. what happened
- Provide step-by-step solutions
- Offer to search for more information if needed

EXAMPLES:

User: "Hi"
You: "Hello! I'm your Power BI Assistant. How can I help you today? Are you working on a report, troubleshooting an issue, or looking for guidance?"

User: "My dashboard is slow"
You: "I understand slow dashboards can be frustrating. To help you better, could you tell me:
1. How many visuals are on the dashboard?
2. Are you using DirectQuery or Import mode?
3. When did you first notice the slowness?"

User: "What's new in Power BI this month?"
You: [Delegate to internet_agent to get latest updates]

User: "Search community for DAX optimization tips"
You: [Delegate to community_agent]

User: "Check our internal docs for the sales report template"
You: [Delegate to rag_agent]

CRITICAL RULES:
- NEVER call tools directly (you have NO tools except transfer_to_agent)
- NEVER make up URLs or sources
- ALWAYS be helpful and user-focused
- Ask questions when you need clarity
- Keep responses concise but complete"""
)

# --------------------------------------------------
# REQUIRED EXPORT FOR ADK CLI
# --------------------------------------------------
root_agent = manager_agent

# --------------------------------------------------
# MANUAL CHAT LOOP
# --------------------------------------------------
async def chat_loop():
    print("=" * 60)
    print("Power BI Assistant Ready!")
    print("=" * 60)
    print(f"Model: Azure Grok ({AZURE_GROK_MODEL}) via LiteLLM")
    print("Capabilities:")
    print("  - Internet Search: Latest Power BI updates and news")
    print("  - Internal Docs: Company documentation and procedures")
    print("  - Community: Forum discussions and user tips")
    print("\nType 'exit' or 'quit' to stop.\n")
    
    session_service = InMemorySessionService()
    runner = Runner(agent=root_agent, app_name="team_app", session_service=session_service)
    
    # Create session
    session = await session_service.create_session(
        app_name="team_app",
        user_id="local_user",
        session_id="local_session_001"
    )
    
    while True:
        try:
            user_input = input("You: ").strip()
            if user_input.lower() in {"exit", "quit", "bye"}:
                print("Goodbye!")
                break
            if not user_input:
                continue
            
            # Create message content
            user_message = types.Content(
                role='user',
                parts=[types.Part(text=user_input)]
            )
            
            # Collect events with added debugging
            final_response_text = "Agent did not produce a final response."
            collected_responses = []  # To aggregate if multiple delegations occur
            
            print("\n--- Debug: Streaming events ---")  # Added for visibility into delegation
            async for event in runner.run_async(
                user_id="local_user",
                session_id=session.id,
                new_message=user_message
            ):
                print(f"Event type: {event.type}, Is final: {event.is_final_response()}")  # Debug: Log events
                # Check for intermediate responses from sub-agents
                if event.content and event.content.parts:
                    collected_responses.append(event.content.parts[0].text)
                # Check for final response
                if event.is_final_response():
                    if event.content and event.content.parts:
                        final_response_text = event.content.parts[0].text
                    else:
                        # Fallback: Join collected responses if no explicit final
                        final_response_text = "\n".join(collected_responses)
                    break
            
            print(f"\nAssistant: {final_response_text}\n")
            print("--- End debug ---\n")
            
        except Exception as e:
            print(f"\nError: {e}\n")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(chat_loop())