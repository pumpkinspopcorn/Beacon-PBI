"""
FastAPI server for the Team Agent Coordinator
"""
import os
import asyncio
from typing import Optional, List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from Agents.team import create_manager_agent
from Agents.search_utils import SearchResult, format_sources_for_response
from Agents.internet_agent import get_search_results_for_session
from Agents.cache import get_cache_stats, clear_cache

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Team Agent API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global coordinator and session service
coordinator = None
session_service = InMemorySessionService()
runner = None

# Initialize coordinator on startup
@app.on_event("startup")
async def startup_event():
    global coordinator, runner
    try:
        if not os.getenv("GROQ_API_KEY"):
            print("Warning: GROQ_API_KEY environment variable not set")
            return
        
        coordinator = create_manager_agent()
        runner = Runner(
            agent=coordinator,
            app_name="team_agent_app",
            session_service=session_service
        )
        print("✓ Team Agent Coordinator initialized")
    except Exception as e:
        print(f"Error initializing coordinator: {e}")
        import traceback
        traceback.print_exc()

# Request/Response models
class QuestionRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

class Source(BaseModel):
    filename: str
    path: str
    type: str
    is_table: bool
    chunks_used: int

class AskResponse(BaseModel):
    answer: str
    sources: list[Source] = []
    has_tables: bool = False
    num_sources: int = 0
    table_count: int = 0
    doc_count: int = 0
    error: Optional[str] = None

# Note: Search results are stored in internet_agent module
# and retrieved via get_search_results_for_session()


# API Endpoints
@app.post("/api/ask", response_model=AskResponse)
async def ask_question(request: QuestionRequest):
    """
    Process a question through the team agent coordinator.
    The manager agent will route to appropriate sub-agents.
    The Internet agent will handle its own search when it receives queries.
    """
    if not coordinator or not runner:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    # Use provided session_id or generate a default one
    user_id = "default_user"
    session_id = request.session_id or "default_session"
    
    try:
        # Create or get session
        try:
            await session_service.create_session(
                app_name="team_agent_app",
                user_id=user_id,
                session_id=session_id
            )
        except Exception:
            # Session might already exist, that's okay
            pass
        
        # Create user message - pass original query to manager agent
        # The manager will decide whether to delegate to Internet agent
        # The Internet agent should handle search internally
        content = types.Content(role='user', parts=[types.Part(text=request.question)])
        
        # Run the agent and get response
        response_text = ""
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    response_text = event.content.parts[0].text
                    break
        
        if not response_text:
            response_text = "I apologize, but I couldn't generate a response."
        
        # Get stored search results for this session (populated by Internet agent)
        search_results = get_search_results_for_session(session_id)
        sources = format_sources_for_response(search_results)
        
        return AskResponse(
            answer=response_text,
            sources=sources,
            has_tables=False,
            num_sources=len(sources),
            table_count=0,
            doc_count=len([s for s in sources if s["type"] == "web"])
        )
    
    except Exception as e:
        return AskResponse(
            answer="",
            sources=[],
            has_tables=False,
            num_sources=0,
            table_count=0,
            doc_count=0,
            error=str(e)
        )

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if coordinator else "unhealthy",
        "vector_search": False,
        "llm": "groq/llama-3.1-8b-instant",
        "sessions": 0
    }

@app.post("/api/clear")
async def clear_history():
    """Clear conversation history"""
    # For now, just return success
    # In a full implementation, you'd clear the session
    return {"status": "success"}

@app.get("/api/history")
async def get_history():
    """Get conversation history"""
    return {"history": []}

@app.get("/api/cache/stats")
async def cache_stats():
    """Get cache statistics"""
    return get_cache_stats()

@app.post("/api/cache/clear")
async def clear_cache_endpoint():
    """Clear the cache"""
    clear_cache()
    return {"status": "success", "message": "Cache cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

