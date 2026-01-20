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
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_API_BASE,
    AZURE_API_VERSION,
    AZURE_API_KEY,
    AZURE_SEARCH_ENDPOINT_COMM, 
    AZURE_SEARCH_KEY_COMM, 
    AZURE_SEARCH_INDEX_COMM,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION
)

# Set up Azure OpenAI credentials for LiteLLM
os.environ["AZURE_API_KEY"] = AZURE_API_KEY
os.environ["AZURE_API_BASE"] = AZURE_API_BASE
os.environ["AZURE_API_VERSION"] = AZURE_API_VERSION

# Create Azure OpenAI model
azure_openai_model = LiteLlm(
    model=AZURE_OPENAI_DEPLOYMENT,
    api_key=AZURE_API_KEY,
    api_base=AZURE_API_BASE,
    api_version=AZURE_API_VERSION
)

# Initialize Azure OpenAI Embeddings lazily (only when needed)
# This prevents SSL initialization hang on Windows during module import
_embeddings = None

def get_embeddings():
    """Lazy initialization of embeddings to avoid SSL hang on startup."""
    global _embeddings
    if _embeddings is None:
        _embeddings = AzureOpenAIEmbeddings(
            azure_deployment=AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            openai_api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY
        )
    return _embeddings

# Keep embeddings variable for backward compatibility (lazy-loaded)
embeddings = None  # Will be initialized via get_embeddings() when needed

# --------------------------------------------------
# TOOL: AZURE AI SEARCH COMMUNITY (Community Index)
# --------------------------------------------------
def community_search_function(query: Annotated[str, "The search query to find relevant community content"]) -> str:
    """Search through community knowledge base using Azure AI Search with semantic search."""
    try:
        # Create retriever with semantic search enabled
        retriever = AzureAISearchRetriever(
            service_name=AZURE_SEARCH_ENDPOINT_COMM.split("//")[1].split(".")[0],
            index_name=AZURE_SEARCH_INDEX_COMM,
            api_key=AZURE_SEARCH_KEY_COMM,
            content_key="chunk",
            top_k=3  # Reduced from 5 to get only the most relevant results
        )
        
        # Perform search
        docs = retriever.invoke(query)
        
        if not docs:
            return "No relevant community content found."
        
        output = []
        seen_sources = set()  # Track unique sources to avoid duplicates
        
        # Debug: Print metadata to see where filename comes from
        if docs:
            print(f"\n=== DEBUG: Community Search Results ===")
            print(f"Query: {query}")
            print(f"Number of results: {len(docs)}")
            for idx, doc in enumerate(docs[:3], 1):  # Show first 3 results
                metadata = doc.metadata if hasattr(doc, 'metadata') else {}
                print(f"\nResult {idx} metadata keys: {list(metadata.keys())}")
                print(f"All metadata values: {metadata}")
                print(f"Content preview: {doc.page_content[:200]}...")
            print("=" * 50 + "\n")
        
        for i, doc in enumerate(docs, 1):
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            
            # Priority order for filename extraction:
            # 1️⃣ Use title first (this fixes your "discussion_2.txt" issue)
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
                    if source.startswith("http://") or source.startswith("https://"):
                        parsed = urlparse(source)
                        path = unquote(parsed.path)
                        file_name = os.path.basename(path) if path else None
                    else:
                        file_name = os.path.basename(source)
            
            # Final fallback to IDs
            if not file_name:
                file_name = metadata.get('document_id') or metadata.get('id') or "Unknown source"
            
            # Clean up the filename
            file_name = os.path.basename(file_name)
            
            # Skip duplicates
            source_key = file_name.lower()
            if source_key in seen_sources:
                continue
            seen_sources.add(source_key)
            
            # Get relevance score
            score = metadata.get('@search.score', metadata.get('score', 'N/A'))
            
            # Extract blob URL (metadata_url is the field name in the index)
            blob_url = metadata.get('metadata_url') or metadata.get('metadata_storage_path') or metadata.get('storage_path') or metadata.get('url') or 'URL not available'
            
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
        return f"Error searching community content: {str(e)}"

community_search_tool = LangchainTool(
    tool=StructuredTool.from_function(
        func=community_search_function,
        name="community_search",
        description="Search through community knowledge base using Azure AI Search. Use this for questions about community discussions, user-generated content, forum posts, or community-contributed information."
    )
)

# --------------------------------------------------
# SUB-AGENT: COMMUNITY AGENT (Community Knowledge)
# --------------------------------------------------
community_agent = Agent(
    name="community_agent",
    description="Community knowledge specialist for user discussions using semantic search.",
    model=azure_openai_model,
    tools=[community_search_tool],
    instruction="""You are a community knowledge specialist. Use community_search to retrieve community discussions.

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

Step 1: Call community_search tool with the user's question
Step 2: Read the search results carefully and FILTER for relevance
Step 3: Identify which results DIRECTLY answer the user's question (ignore loosely related or irrelevant results)
Step 4: Use ONLY the relevant documents to construct your answer
Step 5: Format your response EXACTLY like this:

RESPONSE FORMAT (MANDATORY):

**Answer:**
[Write your answer here based on the search results. Write naturally without citation numbers.]

**Sources:**
SOURCE_START
title: [exact filename from search results]
url: [blob URL from search results]
type: Community Document
SOURCE_END

SOURCE_START
title: [another exact filename]
url: [another blob URL]
type: Community Document
SOURCE_END

[Repeat SOURCE_START/SOURCE_END for each document you used]

CRITICAL RULES:
1. You MUST include BOTH **Answer:** AND **Sources:** sections
2. NEVER skip the **Sources:** section - it is MANDATORY
3. Use the EXACT filename from the search results (after "Source: ")
4. Use the EXACT URL from the search results (after "URL: ")
5. Each source MUST be wrapped in SOURCE_START and SOURCE_END markers
6. Each source MUST have "title: ", "url: ", and "type: " on separate lines
7. ONLY cite sources that you ACTUALLY USED to construct your answer - do not cite documents you did not reference or use
8. Review each search result carefully - if it's not relevant to the user's specific question, do not include it in Sources
9. Be selective: cite 1-3 most relevant documents, not all returned results

EXAMPLE OF CORRECT FORMAT:

**Answer:**
According to the community discussion, you can resolve this issue by clearing your cache. Another user mentioned that restarting the service also helps.

**Sources:**
SOURCE_START
title: discussion_cache_fix.txt
url: https://pbibeaconstorage.blob.core.windows.net/container/discussion_cache_fix.txt
type: Community Document
SOURCE_END

SOURCE_START
title: service_restart_guide.txt
url: https://pbibeaconstorage.blob.core.windows.net/container/service_restart_guide.txt
type: Community Document
SOURCE_END

EXAMPLE OF FILTERING IRRELEVANT RESULTS:
If search returns 5 results but only 2 are relevant to the question:
- Use ONLY the 2 relevant ones in your answer
- Cite ONLY the 2 relevant ones in Sources
- Do NOT cite the 3 irrelevant ones, even though they were returned by the search

If no relevant documents are found:

**Answer:**
I searched the community discussions but did not find relevant information.

**Sources:**
(leave empty - no SOURCE_START/SOURCE_END blocks)

CRITICAL: After completing the response with BOTH Answer and Sources sections, call:
transfer_to_agent(agent_name='manager_agent')
"""
)
