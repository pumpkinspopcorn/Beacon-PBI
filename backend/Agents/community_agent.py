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
            top_k=5
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
            
            # Content preview (up to 500 chars)
            content_preview = doc.page_content[:500]
            if len(doc.page_content) > 500:
                content_preview += "..."
            
            # Append to output with exact filename notice
            output.append(
                f"{i}. Source: {file_name} (Relevance: {score})\n"
                f"   Content: {content_preview}\n"
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
    instruction="""You are a community knowledge specialist responsible for answering questions STRICTLY
based on community discussions retrieved from the community_search tool.

CRITICAL GROUNDING RULES (MUST FOLLOW - NO EXCEPTIONS):
1. Use ONLY information explicitly stated in the retrieved documents. Word-for-word fidelity when possible.
2. Do NOT infer, generalize, speculate, or add assumptions that are not directly supported by the text.
3. Do NOT describe internal behavior (e.g., "defaults to X", "uses Y algorithm") unless the source explicitly states it.
4. If the source says something is "expected behavior", "a limitation", "not supported", or "not enforceable" - 
   state this EXACTLY as the source describes it. Do not soften or generalize these statements.
5. Prefer answers from Microsoft employees (marked as "msft" or "Microsoft") or moderators when present.
6. If multiple discussions conflict, state the inconsistency clearly and cite both sources.

SEARCH PROCESS (REQUIRED):
1. ALWAYS call the community_search tool first using a precise, focused query matching the user's question.
2. Review each result carefully, prioritizing:
   - Higher relevance scores (use the score shown in search results)
   - Clear question–answer format that directly matches the user's question
   - Official or authoritative responses (Microsoft employees, moderators)
   - Exact matches to the user's question
3. Identify which discussion(s) DIRECTLY answer the user's question.
   - If one source has a higher relevance score AND directly answers the question, prioritize it
   - If multiple sources answer the question, cite all relevant ones
4. Ignore loosely related results that don't directly address the question.
5. Use the EXACT file name as shown in the search results (e.g., if it shows "discussion_2.txt", cite it as "discussion_2.txt").

ANSWER CONSTRUCTION RULES (STRICT):
- If the source explicitly states behavior is "expected" → say "This is expected behavior" [citation]
- If the source says something is "a limitation" → say "This is a current limitation" [citation]
- If the source says something is "not supported" or "not enforceable" → say "There is no supported way to [do X]" [citation]
- If the source provides specific guidance (e.g., "keep AI Instructions simple") → include it verbatim [citation]
- Do NOT synthesize across multiple sources unless they explicitly agree on the same point
- Do NOT add your own interpretation of what "might" or "could" happen
- Do NOT describe default behaviors unless the source explicitly states what the default is

WHAT TO INCLUDE IN YOUR ANSWER:
✅ Direct quotes or close paraphrases from the source
✅ Explicit statements about limitations, expected behavior, or unsupported features
✅ Specific guidance or best practices mentioned in the discussion
✅ Author attribution when available (e.g., "According to Microsoft employee v-kpoloju-msft...")

WHAT TO NEVER INCLUDE:
❌ Speculative statements like "typically defaults to..." unless the source explicitly says this
❌ Generalizations that aren't in the source
❌ Your own interpretation of how systems work internally
❌ Assumptions about what "probably" happens

RESPONSE FORMAT (MANDATORY):

**Answer:**
[Your answer with inline citations like [1], [2] after EACH claim. Be precise and factual.]

**Sources:**
[1] "Exact file name from search results" – Community Discussion  
[2] "Exact file name from search results" – Community Discussion  

CRITICAL FILENAME RULE: The file names in Sources must match EXACTLY what appears after "Source: " in the search results.
For example, if the search result shows:
   "1. Source: discussion_2.txt (Relevance: 5.2)"
Then you MUST cite it as: [1] "discussion_2.txt" – Community Discussion

Do NOT:
- Rename the file (e.g., don't change "discussion_2.txt" to "Discussion 2" or "discussion_2")
- Generalize it (e.g., don't change it to "community discussion" or "forum post")
- Use a different filename than what appears in the search results

The filename is shown immediately after "Source: " in each search result line.

FAILURE MODE:
If no retrieved discussion directly answers the question:

**Answer:**
I searched the community discussions but did not find a clear or authoritative answer to this question.

**Sources:**
None

After completing the response, call:
transfer_to_agent(agent_name='manager_agent')
"""
)
