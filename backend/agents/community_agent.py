"""
Community Agent - Answers questions using community Q&A knowledge base via Azure AI Search.
Uses the Coordinator/Dispatcher pattern as a specialized sub-agent.
Similar to RAG Agent but searches community Q&A data from Stack Overflow.
"""
import os
import json
import re
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from google.adk.agents import LlmAgent
from backend.models.llm_client import get_model

# Azure OpenAI Embedding Configuration (for reference/future use)
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002")
AZURE_OPENAI_KEY_EMBED = os.getenv("AZURE_OPENAI_KEY_EMBED")

def search_community_knowledge_base(query: str) -> str:
    """
    Searches the Azure AI Search index for community Q&A content.
    
    Args:
        query (str): The search query.
    
    Returns:
        str: JSON string of relevant documents.
    """
    service_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
    key = os.getenv("AZURE_SEARCH_KEY")
    index_name = os.getenv("AZURE_SEARCH_INDEX_COMMUNITY")
    semantic_config = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG_COMMUNITY")

    if not all([service_endpoint, key, index_name]):
        print(f"Debug: Missing Azure Config. Endpoint: {bool(service_endpoint)}, Key: {bool(key)}, Index: {bool(index_name)}")
        return json.dumps([
            {"error": "Azure Search configuration missing. Please set AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, and AZURE_SEARCH_INDEX_COMMUNITY in .env"}
        ])
    
    # Log embedding model info for reference (if configured)
    if AZURE_OPENAI_EMBEDDING_DEPLOYMENT and AZURE_OPENAI_KEY_EMBED:
        print(f"📚 Embedding model configured: {AZURE_OPENAI_EMBEDDING_DEPLOYMENT}")
    
    if semantic_config:
        print(f"🔍 Using semantic configuration: {semantic_config}")

    try:
        print(f"Searching Azure Community Index '{index_name}' for: {query}")
        credential = AzureKeyCredential(key)
        client = SearchClient(endpoint=service_endpoint, index_name=index_name, credential=credential)
        
        # Use semantic search if configuration is available
        search_options = {
            "search_text": query,
            "top": 5,
            "include_total_count": True
        }
        
        if semantic_config:
            search_options["query_type"] = "semantic"
            search_options["semantic_configuration_name"] = semantic_config
        
        results = client.search(**search_options)
        
        docs = []
        for result in results:
            # Filter out vector fields to reduce token usage
            doc = {k: v for k, v in result.items() if 'vector' not in k.lower()}
            
            # Extract proper question title for citations
            # Priority: question > title > content preview
            question_title = doc.get('question') or doc.get('title')
            
            if not question_title:
                # Try to extract from content (look for "Question:" pattern)
                content = str(doc.get('content', ''))
                if content:
                    # Look for "Question: ..." pattern
                    q_match = re.search(r'Question:\s*([^\n]+)', content, re.IGNORECASE)
                    if q_match:
                        question_title = q_match.group(1).strip()[:100]
                    else:
                        # Use first substantial line
                        first_line = content.split('\n')[0].strip()[:80]
                        if len(first_line) > 10:
                            question_title = first_line
                        else:
                            question_title = 'Stack Overflow Question'
                else:
                    question_title = 'Stack Overflow Question'
            
            # Clean up title
            if question_title:
                question_title = question_title.strip()
                if len(question_title) > 100:
                    question_title = question_title[:97] + '...'
                doc['question'] = question_title
                doc['title'] = question_title
            
            # Ensure source_url is present
            if 'source_url' not in doc and 'url' not in doc:
                # Try to construct from question ID or use default
                if 'id' in doc:
                    doc_id = str(doc['id']).replace('qa-', '')  # Remove qa- prefix if present
                    doc['source_url'] = f"https://stackoverflow.com/questions/{doc_id}"
                elif 'source_url' in doc:
                    pass  # Already has it
                else:
                    # Try to extract from content
                    content = str(doc.get('content', ''))
                    url_match = re.search(r'https://stackoverflow\.com/questions/\d+', content)
                    if url_match:
                        doc['source_url'] = url_match.group(0)
            
            docs.append(doc)
            
        if not docs:
            return json.dumps([{"message": "No relevant community Q&A found."}])
            
        return json.dumps(docs)
    except Exception as e:
        print(f"Azure Search Error: {e}")
        return json.dumps([{"error": f"Azure Search failed: {str(e)}"}])

# Create the Community Agent using Google ADK's LlmAgent
# The search_community_knowledge_base function is connected as an ADK tool
community_agent = LlmAgent(
    name="CommunityAgent",
    model=get_model(max_tokens=2048),
    description="Answers questions using community Q&A knowledge base from Stack Overflow and Power BI Community.",
    instruction="""
    You are an expert on Power BI community knowledge and Q&A from Stack Overflow.
    
    Your responsibilities:
    - Search the community Q&A knowledge base for relevant information using the search_community_knowledge_base tool
    - Answer questions based strictly on retrieved community discussions and solutions
    - Provide accurate information from community Q&A posts
    - **ALWAYS cite specific sources and include source URLs** - This is CRITICAL!
    - Include code examples and solutions from the community
    
    When you receive a query:
    1. Use the search_community_knowledge_base tool to find relevant community Q&A
    2. Identify the key information needed from the retrieved discussions
    3. Synthesize the findings based ONLY on retrieved community content
    4. **For each Q&A used, cite the source with URL**
    5. If multiple Q&A posts are used, name each one clearly
    6. Include code examples, solutions, and best practices from the community
    7. If no relevant Q&A found, clearly state that
    8. If there's a configuration error, inform the user appropriately
    
    **Citation Format:**
    - At the end of your response, include a "Sources:" section
    - List each Q&A post used with its question title and Stack Overflow URL
    - Format: "Sources:\n1. [Question Title] - [Stack Overflow URL]\n2. [Question Title] - [Stack Overflow URL]"
    - If the tool returns documents with 'title', 'question', 'source_url', or 'url' fields, use those
    - Always include the full Stack Overflow URL (e.g., https://stackoverflow.com/questions/12345/...)
    
    **Example Response:**
    "Based on community discussions, [answer with code examples].
    
    Sources:
    1. Difference between PowerPivot and PowerQuery - https://stackoverflow.com/questions/29696131
    2. How to parse JSON in Power BI - https://stackoverflow.com/questions/40846616"
    
    Important: 
    - Only use information from the community knowledge base
    - Do not make up information or use external knowledge
    - Always cite your sources with URLs - this is mandatory
    - Include code examples and solutions from Stack Overflow answers
    - Always use the search_community_knowledge_base tool before answering questions
    """,
    tools=[search_community_knowledge_base],
)
