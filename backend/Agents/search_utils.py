"""
Search utilities for Internet Agent using DuckDuckGo via LangChain
"""

from typing import List, Dict, Optional
from langchain_community.tools import DuckDuckGoSearchRun
from duckduckgo_search import DDGS


class SearchResult:
    """Represents a single search result with source information."""
    def __init__(self, title: str, url: str, snippet: str):
        self.title = title
        self.url = url
        self.snippet = snippet
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "filename": self.title,
            "path": self.url,
            "type": "web",
            "is_table": False,
            "chunks_used": 1
        }
    
    def to_referenced_source(self) -> Dict:
        """Convert to ReferencedSource format for frontend."""
        # Use abs to ensure positive hash
        source_id = abs(hash(self.url)) if self.url else abs(hash(self.title))
        return {
            "id": f"source-{source_id}",
            "type": "file",
            "name": self.title,
            "path": self.url,
            "metadata": {
                "snippet": self.snippet,
                "url": self.url
            }
        }


def search_duckduckgo(query: str, max_results: int = 5) -> tuple[str, List[SearchResult]]:
    """
    Search DuckDuckGo and return formatted results with sources.
    
    Args:
        query: Search query string
        max_results: Maximum number of results to return
        
    Returns:
        Tuple of (formatted_results_text, list_of_search_results)
    """
    try:
        # Use DDGS directly for better control over results
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        
        # Handle empty results
        if not results:
            return f"No search results found for: {query}", []
        
        search_results = []
        formatted_parts = []
        
        for i, result in enumerate(results, 1):
            title = result.get('title', 'No title')
            url = result.get('href', '')
            snippet = result.get('body', 'No description available')
            
            search_result = SearchResult(title, url, snippet)
            search_results.append(search_result)
            
            # Format for LLM context
            formatted_parts.append(
                f"[{i}] {title}\n"
                f"URL: {url}\n"
                f"Summary: {snippet}\n"
            )
        
        formatted_text = "\n".join(formatted_parts)
        return formatted_text, search_results
    
    except Exception as e:
        # Fallback to LangChain tool if DDGS fails
        try:
            search_tool = DuckDuckGoSearchRun()
            raw_result = search_tool.invoke(query)
            
            # Parse the raw result (it's usually a string)
            # Create a basic result
            search_result = SearchResult(
                title=f"Search results for: {query}",
                url="",
                snippet=raw_result[:500] if isinstance(raw_result, str) else str(raw_result)
            )
            search_results = [search_result]
            formatted_text = f"Search Results:\n{raw_result}"
            
            return formatted_text, search_results
        except Exception as fallback_error:
            error_msg = f"Search failed: {str(fallback_error)}"
            return error_msg, []


def format_sources_for_response(search_results: List[SearchResult]) -> List[Dict]:
    """Format search results as sources for API response."""
    return [result.to_dict() for result in search_results]


def format_sources_for_frontend(search_results: List[SearchResult]) -> List[Dict]:
    """Format search results as ReferencedSource for frontend."""
    return [result.to_referenced_source() for result in search_results]

