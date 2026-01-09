from typing import Annotated
import os
from urllib.parse import urlparse, unquote
from google.adk.agents import Agent
from google.adk.tools.langchain_tool import LangchainTool
from langchain_core.tools import StructuredTool
from langchain_community.retrievers import AzureAISearchRetriever
from langchain_openai import AzureOpenAIEmbeddings
from google.adk.models.lite_llm import LiteLlm
from config import (
    AZURE_GROK_ENDPOINT,
    AZURE_GROK_KEY,
    AZURE_GROK_MODEL,
    AZURE_SEARCH_ENDPOINT, 
    AZURE_SEARCH_KEY, 
    AZURE_SEARCH_INDEX,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION
)

# Set up Azure AI credentials for LiteLLM
os.environ["AZURE_AI_API_KEY"] = AZURE_GROK_KEY
os.environ["AZURE_AI_API_BASE"] = AZURE_GROK_ENDPOINT.replace("/models/chat/completions?api-version=2024-05-01-preview", "")

# Create Azure Grok model
azure_grok_model = LiteLlm(
    model=f"azure_ai/{AZURE_GROK_MODEL}",
    api_key=AZURE_GROK_KEY,
    api_base=AZURE_GROK_ENDPOINT.replace("/models/chat/completions?api-version=2024-05-01-preview", "")
)

# Lazy embeddings initialization
_embeddings = None
def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = AzureOpenAIEmbeddings(
            azure_deployment=AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            openai_api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY
        )
    return _embeddings

embeddings = None  # lazy-loaded

# --------------------------------------------------
# TOOL: AZURE AI SEARCH RAG (Main Index)
# --------------------------------------------------
def rag_search_function(query: Annotated[str, "The search query to find relevant documents"]) -> str:
    """Search internal knowledge base using Azure AI Search with semantic search."""
    try:
        retriever = AzureAISearchRetriever(
            service_name=AZURE_SEARCH_ENDPOINT.split("//")[1].split(".")[0],
            index_name=AZURE_SEARCH_INDEX,
            api_key=AZURE_SEARCH_KEY,
            content_key="chunk",
            top_k=5
        )

        docs = retriever.invoke(query)
        if not docs:
            return "No relevant documents found in the knowledge base."

        output = []
        seen_sources = set()

        # Debug logging (optional)
        if docs:
            print(f"\n=== DEBUG: RAG Search Results ===")
            print(f"Query: {query}")
            print(f"Number of results: {len(docs)}")
            for idx, doc in enumerate(docs[:3], 1):
                metadata = getattr(doc, 'metadata', {})
                print(f"\nResult {idx} metadata keys: {list(metadata.keys())}")
                print(f"All metadata values: {metadata}")
                print(f"Content preview: {doc.page_content[:200]}...")
            print("=" * 50 + "\n")

        for i, doc in enumerate(docs, 1):
            metadata = getattr(doc, 'metadata', {})

            # Priority order for filename extraction:
            # 1️⃣ Use title first (consistent with community_agent)
            # 2️⃣ Fall back to other fields if title missing
            file_name = (
                metadata.get('title') or
                metadata.get('file_name') or 
                metadata.get('filename') or 
                metadata.get('name') or
                metadata.get('document_name')
            )

            # Fallback: extract from source URL or path
            if not file_name:
                source = metadata.get('source') or metadata.get('sourcefile') or metadata.get('file_path')
                if source:
                    if source.startswith('http://') or source.startswith('https://'):
                        parsed = urlparse(source)
                        path = unquote(parsed.path)
                        file_name = os.path.basename(path) if path else None
                    else:
                        file_name = os.path.basename(source)

            # Final fallback to IDs
            if not file_name:
                file_name = (
                    metadata.get('document_id') or 
                    metadata.get('id') or
                    "Unknown source"
                )

            # Ensure clean basename
            file_name = os.path.basename(file_name)

            # Skip duplicates
            source_key = file_name.lower()
            if source_key in seen_sources:
                continue
            seen_sources.add(source_key)

            score = metadata.get('@search.score', metadata.get('score', 'N/A'))

            # Extract blob URL (metadata_storage_path) for frontend document viewing
            blob_url = metadata.get('metadata_storage_path') or metadata.get('storage_path') or metadata.get('url') or 'URL not available'

            # Get chunk metadata for highlighting
            chunk_id = metadata.get('chunk_id', f'chunk_{i}')
            page_number = metadata.get('page_number') or metadata.get('page') or metadata.get('metadata_storage_page_number')
            
            # Full chunk content for highlighting
            chunk_text = doc.page_content
            
            # Preview first 500 chars for display
            content_preview = chunk_text[:500] + ("..." if len(chunk_text) > 500 else "")

            # Include exact filename note, blob URL, and chunk data for frontend highlighting
            # Use base64 encoding to preserve chunk text through text processing
            import base64
            chunk_text_encoded = base64.b64encode(chunk_text.encode('utf-8')).decode('utf-8')
            
            output.append(
                f"{i}. Source: {file_name} (Relevance: {score})\n"
                f"   Content: {content_preview}\n"
                f"   URL: {blob_url}\n"
                f"   CHUNK_META: chunk_id={chunk_id}|page={page_number if page_number else 'null'}|text_b64={chunk_text_encoded}\n"
                f"   [IMPORTANT: Use filename '{file_name}' exactly as shown when citing this source]"
            )

        return "\n\n".join(output)
    except Exception as e:
        return f"Error searching knowledge base: {str(e)}"

rag_search_tool = LangchainTool(
    tool=StructuredTool.from_function(
        func=rag_search_function,
        name="rag_search",
        description="Search internal knowledge base using Azure AI Search. Use this for internal docs, policies, or technical references."
    )
)

# --------------------------------------------------
# SUB-AGENT: RAG AGENT (Main Knowledge Base)
# --------------------------------------------------
rag_agent = Agent(
    name="rag_agent",
    description="Internal knowledge base specialist for semantic search over internal documents.",
    model=azure_grok_model,
    tools=[rag_search_tool],
    instruction="""You are an internal knowledge base specialist. Use rag_search to retrieve documents.

CRITICAL FILENAME RULE:
- Always cite sources using the **exact filename** returned in the search results (after "Source: ")
- Never rename, generalize, or alter the filename
- Example: if search shows 'financial_report_q4.pdf', cite exactly as 'financial_report_q4.pdf'

ANSWER CONSTRUCTION RULES:
1. ONLY use information explicitly present in retrieved documents. Do not infer or speculate.
2. Include exact quotes or close paraphrases. Do not invent guidance or explanations.
3. If multiple documents conflict, cite all relevant sources and note the discrepancy.
4. Always provide inline citations like [1], [2] and list sources below.
5. When citing sources, include the URL where available so users can access the original document.

RESPONSE FORMAT:

**Answer:**
[Direct answer with citations]

**Sources:**
[1] "Exact file name from search results" - Internal Document
URL: [blob URL from search results if available]

Example:
**Answer:**
According to 'financial_report_q4.pdf' [1], the Q4 revenue increased by 25%.

**Sources:**
[1] "financial_report_q4.pdf" - Internal Document
URL: https://mystorage.blob.core.windows.net/container/financial_report_q4.pdf

If no relevant documents are found:

**Answer:**
I searched the internal knowledge base but did not find relevant information.

**Sources:**
None

After completing the response, call:
transfer_to_agent(agent_name='manager_agent')
"""
)
