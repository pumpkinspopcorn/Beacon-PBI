from agno.agent import Agent
from agno.tools.duckduckgo import DuckDuckGoTools
from backend.models.llm_client import get_model

internet_agent = Agent(
    name="Internet Agent",
    role="Search the web for real-time information.",
    tools=[DuckDuckGoTools()],
    model=get_model(),
    instructions=[
        "You are an expert web researcher.",
        "Always use the DuckDuckGo tool to find information.",
        "Summarize the results clearly."
    ],
    markdown=True
)
