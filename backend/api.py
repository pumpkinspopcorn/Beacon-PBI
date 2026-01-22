from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import time
import httpx
import shutil
import tempfile
import subprocess
import numpy as np
import whisper
import imageio_ffmpeg
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from fastapi.middleware.cors import CORSMiddleware

# Import the root agent from your team.py
import sys
import os

# Ensure the Agents directory is in the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'Agents'))

from team import root_agent
from observability import (
    get_observability_stats, 
    reset_observability_stats, 
    track_llm_request,
    TOKENS_PER_MILLION,  # Import constant for consistent usage
    DEFAULT_RECENT_REQUESTS_LIMIT  # Import default limit constant
)
from source_extractor import extract_sources_and_citations, format_sources_for_display

# ============================================================================
# API CONFIGURATION CONSTANTS
# ============================================================================

# Timeout in seconds for blob storage document proxy requests
# Longer timeout than web scraping because documents can be large
BLOB_STORAGE_TIMEOUT_SECONDS = 30.0

app = FastAPI(title="PBI Beacon API")

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cleanup orphaned temp files on startup
@app.on_event("startup")
async def cleanup_temp_files():
    """Clean up any orphaned temporary audio files from previous runs."""
    try:
        project_root = os.path.dirname(os.path.abspath(__file__))
        temp_dir = os.path.join(project_root, "temp")
        
        if os.path.exists(temp_dir):
            files = os.listdir(temp_dir)
            for file in files:
                file_path = os.path.join(temp_dir, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"Cleaned up orphaned file: {file}")
            print(f"Temp directory cleanup complete: {len(files)} files removed")
        else:
            print("No temp directory found, will be created on first transcription")
    except Exception as e:
        print(f"Warning: Failed to cleanup temp directory: {e}")

# Initialize ADK components
session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name="pbi_beacon_app", session_service=session_service)

class QuestionRequest(BaseModel):
    question: str
    user_id: Optional[str] = "web_user"
    session_id: Optional[str] = "web_session_001"

class QuestionResponse(BaseModel):
    answer: str
    session_id: str
    sources: Optional[List[dict]] = []
    citations: Optional[List[dict]] = []

# Global variable for the model
whisper_model = None

# Get ffmpeg executable path from imageio_ffmpeg
FFMPEG_PATH = None
try:
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Found ffmpeg at: {FFMPEG_PATH}")
except Exception as e:
    print(f"Warning: Could not find ffmpeg: {e}")

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        print("Loading Whisper model (CPU)...")
        # using 'small' model for better accuracy on CPU
        whisper_model = whisper.load_model("small", device="cpu") 
    return whisper_model

def load_audio_with_ffmpeg(audio_path: str) -> np.ndarray:
    """
    Load audio file and return as numpy array using ffmpeg directly.
    Returns audio as float32 numpy array with 16kHz sample rate (Whisper's expected format).
    """
    if not FFMPEG_PATH:
        raise RuntimeError("FFmpeg not available")
    
    try:
        # Run ffmpeg to extract audio as raw PCM data
        # Output: 16kHz, mono, float32 format
        cmd = [
            FFMPEG_PATH,
            "-nostdin",
            "-threads", "0",
            "-i", audio_path,
            "-f", "s16le",  # 16-bit signed integer PCM
            "-ac", "1",  # Mono
            "-acodec", "pcm_s16le",
            "-ar", "16000",  # 16kHz sample rate (required by Whisper)
            "-"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            check=True,
            timeout=60
        )
        
        # Convert bytes to numpy array
        audio = np.frombuffer(result.stdout, np.int16).flatten().astype(np.float32) / 32768.0
        
        return audio
        
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
        raise RuntimeError(f"Failed to load audio: {e}")
    except Exception as e:
        print(f"Audio loading error: {e}")
        raise

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    temp_audio_path = None
    
    try:
        # Create a temporary file to store the uploaded audio in project root/temp
        project_root = os.path.dirname(os.path.abspath(__file__))
        temp_dir = os.path.join(project_root, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=temp_dir) as temp_audio:
            shutil.copyfileobj(file.file, temp_audio)
            temp_audio_path = temp_audio.name
        
        print(f"Received audio file: {temp_audio_path} ({os.path.getsize(temp_audio_path)} bytes)")
        
        # Load audio directly using our ffmpeg (bypasses Whisper's PATH dependency)
        print(f"Loading audio with ffmpeg...")
        audio = load_audio_with_ffmpeg(temp_audio_path)
        print(f"Audio loaded successfully: shape={audio.shape}, dtype={audio.dtype}")
        
        # Load model and transcribe the audio array directly
        model = get_whisper_model()
        print("Starting transcription...")
        # fp16=False is crucial for CPU inference
        result = model.transcribe(audio, fp16=False)
        
        transcribed_text = result["text"].strip()
        print(f"Transcription result: '{transcribed_text}'")
        
        return {"text": transcribed_text}
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if "ffmpeg" in str(e).lower() or "not available" in str(e).lower():
            raise HTTPException(status_code=500, detail="FFmpeg is not available on the server.")
            
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
        
    finally:
        # Clean up temp file
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
                print(f"Cleaned up temp file: {temp_audio_path}")
            except Exception as e:
                print(f"Failed to clean up {temp_audio_path}: {e}")

@app.post("/api/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    start_time = time.time()
    
    # Track token usage from ADK events
    total_prompt_tokens = 0
    total_completion_tokens = 0
    
    try:
        # Create session if it doesn't exist
        session = await session_service.get_session(
            app_name="pbi_beacon_app",
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        if not session:
            session = await session_service.create_session(
                app_name="pbi_beacon_app",
                user_id=request.user_id,
                session_id=request.session_id
            )

        # Create message content
        user_message = types.Content(
            role='user',
            parts=[types.Part(text=request.question)]
        )

        final_response_text = ""
        all_event_responses = []  # Collect all event responses
        all_sources = []  # Collect sources from all events
        all_citations = []  # Collect citations from all events
        
        # Run the agent and capture token usage from events
        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=request.session_id,
            new_message=user_message
        ):
            # Extract token usage from ADK event's usage_metadata
            if hasattr(event, 'usage_metadata') and event.usage_metadata:
                usage = event.usage_metadata
                prompt_tokens = getattr(usage, 'prompt_token_count', 0) or 0
                completion_tokens = getattr(usage, 'candidates_token_count', 0) or 0
                total_prompt_tokens += prompt_tokens
                total_completion_tokens += completion_tokens
                print(f"[ADK Event] Token usage - prompt: {prompt_tokens}, completion: {completion_tokens}")
            
            # Collect ALL event responses (including from sub-agents and TOOL outputs)
            if event.content and event.content.parts and event.content.parts[0].text:
                event_text = event.content.parts[0].text
                all_event_responses.append(event_text)
                
                # PRIORITY: Extract chunks from TOOL OUTPUT (has CHUNK_META with base64 text)
                has_chunk_meta = "CHUNK_META:" in event_text
                if has_chunk_meta:
                    print(f"[API] Event has CHUNK_META, extracting chunks from tool output...")
                    # Extract chunks directly from tool output using existing function
                    # The extract_sources_and_citations already handles CHUNK_META extraction
                    _, tool_sources, _ = extract_sources_and_citations(event_text)
                    if tool_sources:
                        print(f"[API] ✓ Extracted {len(tool_sources)} sources with chunks from tool output")
                        for src in tool_sources:
                            chunk_info = "with chunk" if src.get('chunk_data') else "no chunk"
                            print(f"[API]   - Tool output: {src.get('title')} ({chunk_info})")
                        all_sources.extend(tool_sources)
                
                # SECONDARY: Extract sources from agent response (for title, url, type)
                has_sources_marker = "**Sources:**" in event_text or "SOURCE_START" in event_text
                if has_sources_marker:
                    print(f"[API] Event has sources marker, extracting from agent response...")
                    print(f"[API] Event text preview (first 500 chars): {event_text[:500]}")
                    _, event_sources, event_citations = extract_sources_and_citations(event_text)
                    if event_sources:
                        print(f"[API] ✓ Extracted {len(event_sources)} sources from agent response")
                        for src in event_sources:
                            chunk_info = "with chunk" if src.get('chunk_data') else "no chunk"
                            print(f"[API]   - Agent response: {src.get('title')} ({src.get('type')}) {chunk_info}")
                        # Merge with existing sources from tool output
                        # If source already exists (by title), merge chunk_data into it
                        for event_src in event_sources:
                            existing = next((s for s in all_sources if s.get('title') == event_src.get('title')), None)
                            if existing:
                                # Merge: keep tool output's chunk_data if it has it, otherwise use agent's
                                if not existing.get('chunk_data') and event_src.get('chunk_data'):
                                    existing['chunk_data'] = event_src['chunk_data']
                                    print(f"[API]   - Merged chunk into existing source: {event_src.get('title')}")
                            else:
                                all_sources.append(event_src)
                    if event_citations:
                        print(f"[API] ✓ Extracted {len(event_citations)} citations from event")
                        all_citations.extend(event_citations)
            
            if event.is_final_response():
                if event.content and event.content.parts:
                    final_response_text = event.content.parts[0].text
                    print(f"[API] Final response from manager ({len(final_response_text)} chars)")
                break

        if not final_response_text:
            raise HTTPException(status_code=500, detail="Agent failed to produce a response")

        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Use ADK token counts if available, otherwise estimate
        if total_prompt_tokens > 0 or total_completion_tokens > 0:
            input_tokens = total_prompt_tokens
            output_tokens = total_completion_tokens
            print(f"[Observability] Using ADK token counts: {input_tokens} in / {output_tokens} out")
        else:
            # Fallback to LiteLLM token_counter for estimation
            try:
                import litellm
                input_tokens = litellm.token_counter(model="gpt-3.5-turbo", text=request.question)
                output_tokens = litellm.token_counter(model="gpt-3.5-turbo", text=final_response_text)
                print(f"[Observability] Using LiteLLM token estimation: {input_tokens} in / {output_tokens} out")
            except Exception as e:
                # Final fallback to simple estimation
                input_tokens = len(request.question) // 4
                output_tokens = len(final_response_text) // 4
                print(f"[Observability] Using simple estimation: {input_tokens} in / {output_tokens} out")
        
        # Track the request
        track_llm_request(
            model="gpt-4.1",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            success=True,
            error=None,
            user_id=request.user_id,
            session_id=request.session_id,
            agent_name="root_agent"
        )
        print(f"[API] ✓ Tracked request: {input_tokens} in / {output_tokens} out / {latency_ms:.0f}ms")

        # Use the final response text for the answer (manager's cleaned response)
        # Extract sources from agent responses
        print(f"[API] Processing final response")
        print(f"[API] Final response length: {len(final_response_text)} chars")
        
        # Extract sources from the final response
        print(f"[API] Extracting sources from response...")
        cleaned_response, final_sources, final_citations = extract_sources_and_citations(final_response_text)
        
        print(f"[API] Extraction results:")
        print(f"  - Sources found: {len(final_sources)}")
        print(f"  - Citations found: {len(final_citations)}")
        
        # Format the sources for display
        formatted_sources = format_sources_for_display(final_sources, final_citations)
        
        if formatted_sources:
            print(f"[API] ✓ Formatted {len(formatted_sources)} sources for display")
            for i, src in enumerate(formatted_sources, 1):
                print(f"    {i}. {src.get('name')} - {src.get('type')}")
        else:
            print(f"[API] ⚠️  No sources to display!")

        return QuestionResponse(
            answer=cleaned_response,
            session_id=request.session_id,
            sources=formatted_sources,
            citations=final_citations
        )

    except Exception as e:
        # Track failed request
        latency_ms = (time.time() - start_time) * 1000
        
        # Use accumulated tokens if any, otherwise estimate
        if total_prompt_tokens > 0:
            input_tokens = total_prompt_tokens
        else:
            try:
                import litellm
                input_tokens = litellm.token_counter(model="gpt-3.5-turbo", text=request.question)
            except:
                input_tokens = len(request.question) // 4
            
        track_llm_request(
            model="gpt-4.1",
            input_tokens=input_tokens,
            output_tokens=total_completion_tokens,
            latency_ms=latency_ms,
            success=False,
            error=str(e)[:500],
            user_id=request.user_id,
            session_id=request.session_id,
            agent_name="root_agent"
        )
        print(f"[API] ✗ Tracked failed request: {str(e)[:100]}")
        
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/document-proxy")
async def proxy_document(request: Request):
    """
    Proxy endpoint to fetch documents from Azure Blob Storage.
    This allows viewing documents even when blob storage doesn't allow public access.
    """
    blob_url = request.query_params.get("url")
    if not blob_url:
        raise HTTPException(status_code=400, detail="Missing 'url' query parameter")
    
    # Decode URL if it's encoded
    from urllib.parse import unquote
    blob_url = unquote(blob_url)
    
    print(f"[DocumentProxy] Requested URL: {blob_url}")
    
    # Validate that it's a blob storage URL (security check)
    if not blob_url.startswith("https://") or "blob.core.windows.net" not in blob_url:
        print(f"[DocumentProxy] Invalid blob storage URL: {blob_url}")
        raise HTTPException(status_code=400, detail="Invalid blob storage URL")
    
    try:
        from azure.storage.blob import BlobServiceClient
        import os
        
        # Get storage credentials from environment
        storage_account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        storage_account_key = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        
        if not storage_account_name or not storage_account_key:
            # Fallback to unauthenticated request if no credentials
            # Use HTTP client with configured timeout for large document downloads
            async with httpx.AsyncClient(timeout=BLOB_STORAGE_TIMEOUT_SECONDS) as client:
                response = await client.get(blob_url, follow_redirects=True)
                response.raise_for_status()
                
                # Detect content type based on file extension
                filename = blob_url.split("/")[-1].lower()
                if filename.endswith('.txt'):
                    content_type = "text/plain; charset=utf-8"
                elif filename.endswith('.pdf'):
                    content_type = "application/pdf"
                else:
                    content_type = response.headers.get("content-type", "application/octet-stream")
                
                return StreamingResponse(
                    iter([response.content]),
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f'inline; filename="{blob_url.split("/")[-1]}"',
                        "Cache-Control": "public, max-age=3600"
                    }
                )
        
        # Parse blob URL to get container and blob name
        # URL format: https://{account}.blob.core.windows.net/{container}/{blob}
        url_parts = blob_url.replace(f"https://{storage_account_name}.blob.core.windows.net/", "").split("/", 1)
        container_name = url_parts[0]
        blob_name = url_parts[1] if len(url_parts) > 1 else ""
        
        # Create blob client with authentication
        blob_service_client = BlobServiceClient(
            account_url=f"https://{storage_account_name}.blob.core.windows.net",
            credential=storage_account_key
        )
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        
        # Download blob
        blob_data = blob_client.download_blob()
        content = blob_data.readall()
        
        # Get content type from blob properties or detect from file extension
        properties = blob_client.get_blob_properties()
        content_type = properties.content_settings.content_type
        
        # Fallback: detect content type based on file extension if not set
        if not content_type:
            filename = blob_name.split("/")[-1].lower()
            if filename.endswith('.txt'):
                content_type = "text/plain; charset=utf-8"
            elif filename.endswith('.pdf'):
                content_type = "application/pdf"
            else:
                content_type = "application/octet-stream"
        
        # Stream the file back to the client
        return StreamingResponse(
            iter([content]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="{blob_name.split("/")[-1]}"',
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        print(f"[DocumentProxy] Error proxying document: {str(e)}")
        print(f"[DocumentProxy] URL was: {blob_url}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error proxying document: {str(e)}")

# Alias endpoint for backward compatibility
@app.get("/api/pdf-proxy")
async def proxy_pdf(request: Request):
    """Alias for /api/document-proxy for backward compatibility."""
    return await proxy_document(request)


@app.get("/api/observability/stats")
async def get_observability_statistics():
    """Get comprehensive observability statistics."""
    try:
        stats = get_observability_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get observability stats: {str(e)}")

@app.get("/api/observability/recent")
async def get_recent_requests(limit: int = DEFAULT_RECENT_REQUESTS_LIMIT):
    """
    Get recent LLM requests.
    
    Args:
        limit: Maximum number of recent requests to return (default: 50)
    
    Returns:
        List of recent request objects with token usage and cost information
    """
    try:
        stats = get_observability_stats()
        # Return array directly for frontend compatibility
        return stats.get("recent_requests", [])[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent requests: {str(e)}")

@app.post("/api/observability/reset")
async def reset_observability_statistics():
    """Reset all observability statistics."""
    try:
        reset_observability_stats()
        return {"message": "Observability statistics reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset observability stats: {str(e)}")

@app.get("/api/observability/pricing")
async def get_pricing_info():
    """
    Get current pricing information for all tracked models.
    
    Returns pricing data from LiteLLM's database or web sources.
    """
    try:
        from observability import observability_tracker
        
        # Get unique models from tracked requests
        stats = get_observability_stats()
        models = list(stats.get("by_model", {}).keys())
        
        pricing_info = {}
        for model in models:
            # Try to get pricing from LiteLLM
            try:
                import litellm
                # Get cost for 1M tokens to show the per-million rate
                # Using TOKENS_PER_MILLION constant for consistency
                input_cost, output_cost = litellm.cost_per_token(
                    model=model,
                    prompt_tokens=TOKENS_PER_MILLION,
                    completion_tokens=TOKENS_PER_MILLION
                )
                pricing_info[model] = {
                    "input_per_1M": input_cost,
                    "output_per_1M": output_cost,
                    "source": "litellm"
                }
            except Exception:
                # Try fetching from web
                web_pricing = observability_tracker._fetch_pricing_from_web(model)
                if web_pricing:
                    pricing_info[model] = {
                        "input_per_1M": web_pricing["input_per_1m"],
                        "output_per_1M": web_pricing["output_per_1m"],
                        "source": web_pricing.get("source", "web"),
                        "last_updated": web_pricing.get("last_updated", "unknown")
                    }
                else:
                    # No pricing found for this model
                    pricing_info[model] = {
                        "input_per_1M": None,
                        "output_per_1M": None,
                        "source": "unavailable",
                        "error": f"No pricing data available for {model}. Please update LiteLLM or verify model name."
                    }
        
        return {
            "pricing": pricing_info,
            "note": "Pricing is fetched dynamically from LiteLLM's database or web sources. Update with: pip install --upgrade litellm"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pricing info: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
