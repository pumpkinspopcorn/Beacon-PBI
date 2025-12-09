from agno.team import Team
from backend.agents.internet_agent import internet_agent
from backend.agents.rag_agent import rag_agent
from backend.models.llm_client import get_model

orchestrator = Team(
    name="Orchestrator",
    members=[internet_agent, rag_agent],
    model=get_model(),
    instructions=[
        "You are the team leader.",
        "Delegate questions to the Internet Agent if they require external/real-time info.",
        "Delegate questions to the RAG Agent if they are about internal documents.",
        "Synthesize the answer if multiple agents are used."
    ],
    markdown=True
)
