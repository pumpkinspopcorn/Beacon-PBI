import os
import json
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from agno.agent import Agent
from backend.models.llm_client import get_model

def search_knowledge_base(query: str) -> str:
    """
    Searches the Azure AI Search index for the given query.

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

rag_agent = Agent(
    name="RAG Agent",
    role="Answer questions using internal knowledge base.",
    tools=[search_knowledge_base],
    model=get_model(),
    instructions=[
        "You are an expert on internal company documents.",
        "Always use the search_knowledge_base tool to find relevant documents.",
        "Answer based strictly on the retrieved documents.",
        "If the tool returns an error about configuration, inform the user."
    ],
    markdown=True
)
