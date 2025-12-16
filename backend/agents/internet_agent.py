"""
Internet Agent - Searches the web for real-time information using Google ADK.
Uses the Coordinator/Dispatcher pattern as a specialized sub-agent.
Integrated with Langchain's DuckDuckGo search tool with source references.
"""
from google.adk.agents import LlmAgent
from langchain_community.tools import DuckDuckGoSearchResults
from backend.models.llm_client import get_model
import re

# Initialize DuckDuckGo search tool that returns structured results with sources
_ddg_tool = DuckDuckGoSearchResults()

def search_web(query: str) -> str:
    """
    Search the web using DuckDuckGo and return results with source references.
    
    This performs a search engine query (like Google) - it does NOT visit/scrape websites.
    Returns search snippets with titles and URLs.
    
    Args:
        query: The search query string
        
    Returns:
        str: Formatted search results with sources (titles, URLs, snippets)
    """
    try:
        # Get structured results from DuckDuckGo
        raw_results = _ddg_tool.invoke(query)
        
        # Parse the results to extract sources
        # Format: "snippet: ..., title: ..., link: ..., snippet: ..., title: ..., link: ..."
        links = re.findall(r'link: (https?://[^,]+)', raw_results)
        titles = re.findall(r'title: ([^,]+?)(?:, link:|, snippet:)', raw_results)
        snippets = re.findall(r'snippet: ([^,]+?)(?:, title:|, link:)', raw_results)
        
        if not links:
            return f"Search completed but no results found for: {query}"
        
        # Format results with sources
        formatted_results = f"Search results for '{query}':\n\n"
        
        for i, (title, link) in enumerate(zip(titles, links), 1):
            formatted_results += f"{i}. {title.strip()}\n"
            formatted_results += f"   Source: {link.strip()}\n"
            if i <= len(snippets):
                snippet = snippets[i-1].strip()
                formatted_results += f"   {snippet}\n"
            formatted_results += "\n"
        
        return formatted_results
        
    except Exception as e:
        return f"Search failed: {str(e)}"

# Create the Internet Agent using Google ADK's LlmAgent
internet_agent = LlmAgent(
    name="InternetAgent",
    model=get_model(max_tokens=2048),
    description="Searches the web for real-time information and current events using DuckDuckGo.",
    instruction="""
    You are an expert web researcher specializing in finding real-time information.
    
    Your responsibilities:
    - Search for current events, news, and up-to-date information using the search_web tool
    - Provide accurate and timely information from the internet
    - Summarize search results clearly and concisely
    - **ALWAYS cite sources with URLs** - This is CRITICAL!
    
    When you receive a query:
    1. Use the search_web tool to find relevant and recent information
    2. The tool will return results with "Source: [URL]" for each result
    3. Read and synthesize the information from the search results
    4. In your response, ALWAYS include the source URLs you used
    5. Format sources clearly at the end or inline
    
    Response Format Example:
    "Based on my web search, [answer to the query].
    
    Sources:
    - [Source 1 Title]: [URL]
    - [Source 2 Title]: [URL]"
    
    CRITICAL RULES:
    - NEVER answer without citing the source URLs
    - ALWAYS include at least the URLs from the search results
    - If multiple sources say the same thing, cite all of them
    - Make sources easy to find (bold, list format, or inline citations)
    
    Always use the search_web tool before providing answers.
    """,
    tools=[search_web],
)
