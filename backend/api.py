"""
FastAPI server that wraps the Orchestrator agent.
Provides REST and streaming endpoints for the frontend chat interface.
"""
import os
import sys
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import tempfile
import speech_recognition as sr
from pydub import AudioSegment
import io
import re
import json

# Load environment variables
load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.orchestrator import orchestrator
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types


# Session service (in-memory for now, can be replaced with Redis/DB later)
session_service = InMemorySessionService()

# Runner for the orchestrator
# ADK derives app_name from agent load path - must match for sessions to work
APP_NAME = "agents"  # Matches what ADK expects from the load path

runner = Runner(
    agent=orchestrator,
    app_name=APP_NAME,
    session_service=session_service,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 PBI Beacon API starting up...")
    yield
    print("👋 PBI Beacon API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="PBI Beacon API",
    description="AI-powered Power BI assistant with RAG, Internet Search, and Community agents",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8080",  # Vite alternative port
        "http://localhost:3000",  # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ChatRequest(BaseModel):
    """Chat message request from frontend."""
    message: str
    session_id: Optional[str] = "default"
    user_id: Optional[str] = "user"


class SourceReference(BaseModel):
    """Source reference for citations."""
    id: str
    type: str  # 'doc' | 'file' | 'url'
    name: str
    url: Optional[str] = None
    path: Optional[str] = None

class ChatResponse(BaseModel):
    """Chat message response to frontend."""
    response: str
    session_id: str
    sources: Optional[list[SourceReference]] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agents: list[str]


def extract_sources_from_response(response_text: str, agents_called: list) -> list[SourceReference]:
    """
    Extract source references from the response text.
    Looks for:
    1. "Sources:" section in the response (formatted by agents)
    2. URLs in the response (Stack Overflow, document links, etc.)
    
    Filters out:
    - Single character names (like "D.pdf")
    - Unclear/nonsensical document names
    - Sources that don't appear relevant
    """
    sources = []
    source_id_counter = 1
    seen_urls = set()
    seen_names = set()
    
    # Extract from "Sources:" section in response (formatted by agents)
    sources_section = re.search(r'Sources?:?\s*\n((?:\d+\.\s*[^\n]+\n?)+)', response_text, re.IGNORECASE | re.MULTILINE)
    if sources_section:
        sources_text = sources_section.group(1)
        # Parse numbered list: "1. Name - URL" or "1. Name"
        source_items = re.findall(r'\d+\.\s*([^-]+?)(?:\s*-\s*(https?://[^\s\)]+))?', sources_text)
        for name, url in source_items:
            name = name.strip()
            url = url.strip() if url else None
            
            # Filter out invalid names
            # Skip single characters, unclear names, or names that are just file extensions
            if not name or len(name) <= 1:
                continue
            if name.lower() in ['d', 'd.pdf', '.pdf', 'pdf', 'doc', 'document']:
                continue
            if re.match(r'^[a-z]\.(pdf|doc|txt)$', name.lower()):  # Single letter files like "d.pdf"
                continue
            
            # Skip if already seen
            if name in seen_names or (url and url in seen_urls):
                continue
            
            seen_names.add(name)
            if url:
                seen_urls.add(url)
            
            # Determine type based on URL or agent
            source_type = 'doc'
            if 'stackoverflow.com' in (url or ''):
                source_type = 'doc'  # Community Q&A
            elif any(agent in ['RAGAgent'] for agent in agents_called):
                source_type = 'doc'  # Internal docs
            elif url:
                source_type = 'url'
            
            sources.append(SourceReference(
                id=f"src-{source_id_counter}",
                type=source_type,
                name=name[:100] if name else f"Source {source_id_counter}",  # Limit length
                url=url,
                path=url  # Use URL as path for clickable links
            ))
            source_id_counter += 1
    
    # Extract additional URLs from response (if not already in Sources section)
    # Look for Stack Overflow URLs and other document links
    urls = re.findall(r'https?://[^\s\)]+', response_text)
    for url in urls:
        if url not in seen_urls and len(sources) < 10:  # Limit to 10 sources
            seen_urls.add(url)
            
            # Skip common non-source URLs
            if any(skip in url.lower() for skip in ['localhost', '127.0.0.1', 'api/', '/api/']):
                continue
            
            # Extract domain name for display
            domain_match = re.search(r'https?://(?:www\.)?([^/]+)', url)
            domain = domain_match.group(1) if domain_match else "Source"
            
            # Determine type
            source_type = 'doc'
            if 'stackoverflow.com' in url:
                source_type = 'doc'  # Community Q&A
                # Try to extract question title from URL if possible
                q_match = re.search(r'/questions/(\d+)/([^/]+)', url)
                if q_match:
                    question_slug = q_match.group(2).replace('-', ' ').title()
                    name = question_slug[:80]
                else:
                    name = "Stack Overflow Question"
            elif any(agent in ['RAGAgent'] for agent in agents_called):
                source_type = 'doc'  # Internal docs
                name = domain.replace('.com', '').replace('.', ' ').title()
            else:
                source_type = 'url'
                name = domain.replace('.com', '').replace('.', ' ').title()
            
            sources.append(SourceReference(
                id=f"src-{source_id_counter}",
                type=source_type,
                name=name[:100],
                url=url,
                path=url
            ))
            source_id_counter += 1
    
    return sources[:10]  # Return max 10 sources


# Reports directory
from pathlib import Path
from fastapi.responses import FileResponse
REPORTS_DIR = Path(__file__).parent.parent / "reports"


# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        agents=["Orchestrator", "RAGAgent", "InternetAgent", "CommunityAgent", "ReportFinderAgent"]
    )


@app.get("/api/reports/{filename}")
async def get_report(filename: str):
    """
    Serve a PDF report file.
    Used by the frontend to display reports found by ReportFinderAgent.
    """
    # Sanitize filename to prevent directory traversal
    safe_filename = Path(filename).name
    file_path = REPORTS_DIR / safe_filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Report not found: {filename}")
    
    if not file_path.suffix.lower() == ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=safe_filename
    )


@app.get("/api/reports")
async def list_reports():
    """List all available PDF reports."""
    if not REPORTS_DIR.exists():
        return {"reports": [], "message": "Reports folder not found"}
    
    pdf_files = list(REPORTS_DIR.glob("*.pdf")) + list(REPORTS_DIR.glob("*.PDF"))
    
    reports = []
    for pdf_path in sorted(pdf_files, key=lambda x: x.name.lower()):
        size_bytes = pdf_path.stat().st_size
        reports.append({
            "name": pdf_path.stem.replace("_", " ").replace("-", " ").title(),
            "filename": pdf_path.name,
            "url": f"/api/reports/{pdf_path.name}",
            "size_kb": round(size_bytes / 1024, 1)
        })
    
    return {"reports": reports, "count": len(reports)}


# Speech-to-text endpoint
class TranscribeResponse(BaseModel):
    """Transcription response."""
    text: str
    success: bool
    error: Optional[str] = None


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio file to text using SpeechRecognition.
    Accepts webm, wav, mp3, ogg, m4a audio files.
    """
    try:
        # Read the uploaded audio file
        audio_bytes = await audio.read()
        
        # Get file extension from content type or filename
        content_type = audio.content_type or ""
        filename = audio.filename or "audio.webm"
        
        print(f"🎤 Received audio: {filename} ({content_type}, {len(audio_bytes)} bytes)")
        
        # Convert audio to WAV format (required by SpeechRecognition)
        try:
            # Determine input format
            if "webm" in content_type or filename.endswith(".webm"):
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="webm")
            elif "ogg" in content_type or filename.endswith(".ogg"):
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="ogg")
            elif "mp3" in content_type or filename.endswith(".mp3"):
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
            elif "m4a" in content_type or filename.endswith(".m4a"):
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="m4a")
            elif "wav" in content_type or filename.endswith(".wav"):
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="wav")
            else:
                # Try to auto-detect
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
            
            # Convert to WAV
            wav_io = io.BytesIO()
            audio_segment.export(wav_io, format="wav")
            wav_io.seek(0)
            wav_bytes = wav_io.read()
            
        except Exception as e:
            print(f"❌ Audio conversion error: {e}")
            return TranscribeResponse(
                text="",
                success=False,
                error=f"Failed to process audio format: {str(e)}"
            )
        
        # Use SpeechRecognition to transcribe
        recognizer = sr.Recognizer()
        
        # Create AudioFile from WAV bytes
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp_file:
            tmp_file.write(wav_bytes)
            tmp_file.flush()
            
            with sr.AudioFile(tmp_file.name) as source:
                audio_data = recognizer.record(source)
        
        # Transcribe using Google's free speech recognition API
        try:
            text = recognizer.recognize_google(audio_data)
            print(f"✅ Transcribed: {text[:100]}...")
            return TranscribeResponse(text=text, success=True)
        except sr.UnknownValueError:
            return TranscribeResponse(
                text="",
                success=False,
                error="Could not understand audio. Please speak clearly and try again."
            )
        except sr.RequestError as e:
            return TranscribeResponse(
                text="",
                success=False,
                error=f"Speech recognition service error: {str(e)}"
            )
            
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        return TranscribeResponse(
            text="",
            success=False,
            error=str(e)
        )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the orchestrator and get a response.
    This is a non-streaming endpoint - waits for full response.
    """
    try:
        # Always try to create session first (ignore if exists)
        try:
            await session_service.create_session(
                app_name=APP_NAME,
                user_id=request.user_id,
                session_id=request.session_id
            )
            print(f"✓ Created new session: {request.session_id}")
        except Exception as e:
            # Session might already exist, that's OK
            print(f"Session exists or error: {e}")
        
        # Create message content
        message = types.Content(
            role='user',
            parts=[types.Part(text=request.message)]
        )
        
        # Run the agent and collect response with debug logging
        response_text = ""
        agents_called = []
        
        print(f"\n{'='*60}")
        print(f"📨 Query: {request.message[:100]}...")
        print(f"{'='*60}")
        
        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=request.session_id,
            new_message=message,
        ):
            # Debug: Log which agent is responding
            if hasattr(event, 'author') and event.author:
                if event.author not in agents_called:
                    agents_called.append(event.author)
                    print(f"🤖 Agent called: {event.author}")
            
            # Debug: Log tool calls
            if hasattr(event, 'actions') and event.actions:
                for action in event.actions.actions if hasattr(event.actions, 'actions') else []:
                    if hasattr(action, 'tool_name'):
                        print(f"🔧 Tool call: {action.tool_name}")
            
            # Collect final response
            if event.is_final_response() and event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, 'text') and part.text:
                        response_text += part.text
        
        print(f"✅ Response complete. Agents used: {agents_called}")
        print(f"{'='*60}\n")
        
        # Extract sources from response text
        sources = extract_sources_from_response(response_text, agents_called)
        
        return ChatResponse(
            response=response_text,
            session_id=request.session_id,
            sources=sources if sources else None,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Send a message to the orchestrator and stream the response.
    Returns Server-Sent Events (SSE) for real-time streaming.
    """
    async def generate():
        try:
            # Always try to create session first (ignore if exists)
            try:
                await session_service.create_session(
                    app_name=APP_NAME,
                    user_id=request.user_id,
                    session_id=request.session_id
                )
            except Exception:
                pass  # Session might already exist
            
            # Create message content
            message = types.Content(
                role='user',
                parts=[types.Part(text=request.message)]
            )
            
            # Run the agent and stream response
            async for event in runner.run_async(
                user_id=request.user_id,
                session_id=request.session_id,
                new_message=message,
            ):
                # Stream text chunks as they arrive
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            # SSE format
                            yield f"data: {part.text}\n\n"
            
            # Signal end of stream
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/session/new")
async def create_new_session(user_id: str = "user"):
    """Create a new chat session."""
    import uuid
    session_id = str(uuid.uuid4())
    
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id
    )
    
    return {"session_id": session_id}


# Run with: uvicorn backend.api:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

