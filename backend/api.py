from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import time
import httpx
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
from observability import get_observability_stats, reset_observability_stats, track_llm_request
from source_extractor import extract_sources_and_citations, format_sources_for_display

app = FastAPI(title="PBI Beacon API")

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    start_time = time.time()
    
    # Track token usage from ADK events
    total_prompt_tokens = 0
    total_completion_tokens = 0
    
    try:
        # Create session if it doesn't exist (ADK handles existing sessions)
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
            
            # Collect ALL event responses (including from sub-agents)
            if event.content and event.content.parts and event.content.parts[0].text:
                event_text = event.content.parts[0].text
                all_event_responses.append(event_text)
                
                # Extract sources from this event (could be from sub-agent)
                if "**Sources:**" in event_text or "SOURCE_START" in event_text:
                    print(f"[API] Event has sources, extracting...")
                    _, event_sources, event_citations = extract_sources_and_citations(event_text)
                    if event_sources:
                        print(f"[API] ✓ Extracted {len(event_sources)} sources from event")
                        all_sources.extend(event_sources)
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
        # But use sources collected from ALL events (including sub-agents)
        print(f"[API] Processing final response and collected sources")
        print(f"[API] Final response length: {len(final_response_text)} chars")
        print(f"[API] Sources collected from events: {len(all_sources)}")
        print(f"[API] Citations collected from events: {len(all_citations)}")
        
        # Clean the final response (remove any remaining source markers)
        cleaned_response, _, _ = extract_sources_and_citations(final_response_text)
        
        # Format the sources we collected from all events
        formatted_sources = format_sources_for_display(all_sources, all_citations)
        
        print(f"[API] Extraction results:")
        print(f"  - Sources found: {len(all_sources)}")
        print(f"  - Citations found: {len(all_citations)}")
        print(f"  - Formatted sources: {len(formatted_sources)}")
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
            citations=all_citations
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
    
    # Validate that it's a blob storage URL (security check)
    if not blob_url.startswith("https://") or "blob.core.windows.net" not in blob_url:
        raise HTTPException(status_code=400, detail="Invalid blob storage URL")
    
    try:
        from azure.storage.blob import BlobServiceClient
        import os
        
        # Get storage credentials from environment
        storage_account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        storage_account_key = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        
        if not storage_account_name or not storage_account_key:
            # Fallback to unauthenticated request if no credentials
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(blob_url, follow_redirects=True)
                response.raise_for_status()
                content_type = response.headers.get("content-type", "application/pdf")
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
        
        # Get content type
        properties = blob_client.get_blob_properties()
        content_type = properties.content_settings.content_type or "application/pdf"
        
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
        raise HTTPException(status_code=500, detail=f"Error proxying document: {str(e)}")


@app.get("/api/observability/stats")
async def get_observability_statistics():
    """Get comprehensive observability statistics."""
    try:
        stats = get_observability_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get observability stats: {str(e)}")

@app.get("/api/observability/recent")
async def get_recent_requests(limit: int = 50):
    """Get recent LLM requests."""
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
    """Get current pricing information for all tracked models."""
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
                input_cost, output_cost = litellm.cost_per_token(
                    model=model,
                    prompt_tokens=1_000_000,
                    completion_tokens=1_000_000
                )
                pricing_info[model] = {
                    "input_per_1M": input_cost,
                    "output_per_1M": output_cost,
                    "source": "litellm"
                }
            except Exception:
                # Check cache
                with observability_tracker._pricing_cache_lock:
                    if model in observability_tracker._pricing_cache:
                        cached = observability_tracker._pricing_cache[model]
                        pricing_info[model] = {
                            "input_per_1M": cached["input"],
                            "output_per_1M": cached["output"],
                            "source": cached.get("source", "cache"),
                            "last_updated": cached.get("last_updated", "unknown")
                        }
                    else:
                        pricing_info[model] = {
                            "input_per_1M": 2.00,
                            "output_per_1M": 8.00,
                            "source": "fallback_estimate",
                            "warning": "No pricing data available. Using conservative estimate."
                        }
        
        return {
            "pricing": pricing_info,
            "note": "Pricing is fetched dynamically from LiteLLM's database. Update with: pip install --upgrade litellm"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pricing info: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
