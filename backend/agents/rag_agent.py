"""
RAG Agent - Answers questions using internal knowledge base via Azure AI Search.
Uses the Coordinator/Dispatcher pattern as a specialized sub-agent.
"""
import os
import json
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from google.adk.agents import LlmAgent
from backend.models.llm_client import get_model

# Azure OpenAI Embedding Configuration (for reference/future use)
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002")
AZURE_OPENAI_KEY_EMBED = os.getenv("AZURE_OPENAI_KEY_EMBED")

def search_knowledge_base(query: str) -> str:
    """
    Searches the Azure AI Search index for the given query.
    This function can be converted to an ADK FunctionTool in the future.

    Args:
        query (str): The search query.

    Returns:
        str: JSON string of relevant documents.
    """
    service_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
    key = os.getenv("AZURE_SEARCH_KEY")
    index_name = os.getenv("AZURE_SEARCH_INDEX")

    if not all([service_endpoint, key, index_name]):
        print(f"Debug: Missing Azure Config. Endpoint: {bool(service_endpoint)}, Key: {bool(key)}, Index: {bool(index_name)}")
        return json.dumps([
            {"error": "Azure Search configuration missing. Please set AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, and AZURE_SEARCH_INDEX in .env"}
        ])
    
    # Log embedding model info for reference (if configured)
    if AZURE_OPENAI_EMBEDDING_DEPLOYMENT and AZURE_OPENAI_KEY_EMBED:
        print(f"📚 Embedding model configured: {AZURE_OPENAI_EMBEDDING_DEPLOYMENT}")

    try:
        print(f"Searching Azure Index '{index_name}' for: {query}")
        credential = AzureKeyCredential(key)
        client = SearchClient(endpoint=service_endpoint, index_name=index_name, credential=credential)
        
        results = client.search(search_text=query, top=5)
        
        docs = []
        for result in results:
            # Filter out vector fields to reduce token usage
            doc = {k: v for k, v in result.items() if 'vector' not in k.lower()}
            
            # Extract proper document name/title for citations
            # Priority: metadata.title > metadata.name > filename (without extension) > content preview
            doc_title = None
            if 'metadata' in doc and isinstance(doc['metadata'], dict):
                doc_title = doc['metadata'].get('title') or doc['metadata'].get('name')
            
            if not doc_title:
                doc_title = doc.get('title') or doc.get('name')
            
            if not doc_title and 'metadata_storage_path' in doc:
                # Extract filename from storage path
                path = doc.get('metadata_storage_path', '')
                filename = os.path.basename(path) if path else ''
                if filename:
                    # Remove extension and clean up
                    doc_title = os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ').title()
            
            if not doc_title:
                # Try to extract from content (first line or heading)
                content = str(doc.get('content', ''))
                if content:
                    first_line = content.split('\n')[0].strip()[:80]
                    if len(first_line) > 10:
                        doc_title = first_line
                    else:
                        doc_title = 'Document'
                else:
                    doc_title = 'Document'
            
            # Clean up title - remove weird characters, ensure it's meaningful
            if doc_title and len(doc_title) > 1:
                # Remove single character titles like "D" unless it's clearly a name
                if len(doc_title.strip()) == 1 and doc_title.strip().isalpha():
                    doc_title = f"Document {doc_title}"
                
                doc['title'] = doc_title
                doc['document_name'] = doc_title  # Also store as document_name for consistency
            
            docs.append(doc)
            
        if not docs:
            return json.dumps([{"message": "No relevant documents found."}])
            
        return json.dumps(docs)
    except Exception as e:
        print(f"Azure Search Error: {e}")
        return json.dumps([{"error": f"Azure Search failed: {str(e)}"}])

# Create the RAG Agent using Google ADK's LlmAgent
# The search_knowledge_base function is connected as an ADK tool
rag_agent = LlmAgent(
    name="RAGAgent",
    model=get_model(max_tokens=2048),
    description="Answers questions using the internal knowledge base and company documents.",
    instruction="""
    You are an expert on internal company documents and knowledge base.
    
    Your responsibilities:
    - Search the internal knowledge base for relevant information using the search_knowledge_base tool
    - Answer questions based strictly on retrieved documents
    - Provide accurate information from company documentation
    - **ALWAYS cite specific documents and include source URLs** - This is CRITICAL!
    
    When you receive a query:
    1. Use the search_knowledge_base tool to find relevant documents
    2. **FILTER the results** - Only use documents that directly address the user's query
    3. **IGNORE irrelevant documents** - If a document is about a different topic, do NOT include it
    4. Identify the key information needed from the **relevant** retrieved documents
    5. Synthesize the findings based ONLY on retrieved documents that answer the query
    6. **For each piece of information, cite the source document with its proper name**
    7. If multiple documents are used, name each one clearly using the 'title' or 'document_name' field
    8. **DO NOT cite documents that don't address the query** - Only cite what's actually used
    9. If no relevant documents are found, clearly state that
    10. If there's a configuration error, inform the user appropriately
    
    **Citation Format:**
    - At the end of your response, include a "Sources:" section
    - List each document used with its **proper name/title** and URL (if available)
    - **Use the document name from the 'title' or 'document_name' field** - do NOT use unclear names like "D.pdf"
    - Format: "Sources:\n1. [Document Name] - [URL if available]\n2. [Document Name] - [URL if available]"
    - If the tool returns document metadata with 'title', 'document_name', 'name', 'source', or 'url' fields, use those
    - **Only cite documents that actually address the user's query** - filter out irrelevant documents
    
    **Example Response:**
    "Based on the internal documentation, [answer].
    
    Sources:
    1. Power BI Best Practices Guide - https://...
    2. DAX Reference Manual - https://..."
    
    Important: 
    - Only use information from the internal knowledge base
    - **Only include information that directly answers the user's query**
    - **Filter out irrelevant documents and information**
    - Do not make up information or use external knowledge
    - Always cite your sources with proper document names - this is mandatory
    - **Use document names from 'title' or 'document_name' fields, not unclear names like "D.pdf"**
    - Always use the search_knowledge_base tool before answering questions
    """,
    tools=[search_knowledge_base],
)
