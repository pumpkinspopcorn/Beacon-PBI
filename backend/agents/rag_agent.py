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

    try:
        print(f"Searching Azure Index '{index_name}' for: {query}")
        credential = AzureKeyCredential(key)
        client = SearchClient(endpoint=service_endpoint, index_name=index_name, credential=credential)
        
        results = client.search(search_text=query, top=5)
        
        docs = []
        for result in results:
            # Filter out vector fields to reduce token usage
            doc = {k: v for k, v in result.items() if 'vector' not in k.lower()}
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
    model=get_model(),
    description="Answers questions using the internal knowledge base and company documents.",
    instruction="""
    You are an expert on internal company documents and knowledge base.
    
    Your responsibilities:
    - Search the internal knowledge base for relevant information using the search_knowledge_base tool
    - Answer questions based strictly on retrieved documents
    - Provide accurate information from company documentation
    - Cite specific documents when available
    
    When you receive a query:
    1. Use the search_knowledge_base tool to find relevant documents
    2. Identify the key information needed from the retrieved documents
    3. Synthesize the findings based ONLY on retrieved documents
    4. If no relevant documents are found, clearly state that
    5. If there's a configuration error, inform the user appropriately
    
    Important: Only use information from the internal knowledge base.
    Do not make up information or use external knowledge.
    Always use the search_knowledge_base tool before answering questions.
    """,
    tools=[search_knowledge_base],
)
