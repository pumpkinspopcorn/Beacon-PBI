from typing import Annotated
import os
from google.adk.agents import Agent
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_core.tools import StructuredTool
from google.adk.models.lite_llm import LiteLlm
from config import AZURE_OPENAI_DEPLOYMENT, AZURE_API_BASE, AZURE_API_VERSION, AZURE_API_KEY

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

# --------------------------------------------------
# TOOL: DUCKDUCKGO SEARCH
# --------------------------------------------------
# Initialize DuckDuckGoSearchResults with output_format="list" for structured results
_duckduckgo_instance = None

def get_duckduckgo_instance():
    """Lazy initialization of DuckDuckGo tool."""
    global _duckduckgo_instance
    if _duckduckgo_instance is None:
        _duckduckgo_instance = DuckDuckGoSearchResults(
            num_results=5,
            output_format="list"  # Returns list of dicts with title, link, snippet
        )
    return _duckduckgo_instance

def duckduckgo_search_function(query: Annotated[str, "The search query string to search the web"]) -> str:
    """Search the web using DuckDuckGo. Returns a list of search results, each with 'title', 'link', and 'snippet' fields."""
    try:
        tool_instance = get_duckduckgo_instance()
        results = tool_instance.invoke(query)
        
        # Format results for better readability
        if not results:
            return "No search results found."
        
        # Results should be a list of dicts with 'title', 'link', 'snippet'
        formatted_results = []
        for i, result in enumerate(results, 1):
            if isinstance(result, dict):
                title = result.get('title', 'No title')
                link = result.get('link', 'No link')
                snippet = result.get('snippet', 'No snippet')
                formatted_results.append(f"{i}. Title: {title}\n   Link: {link}\n   Snippet: {snippet}")
            else:
                formatted_results.append(f"{i}. {result}")
        
        return "\n\n".join(formatted_results) if formatted_results else str(results)
    except Exception as e:
        return f"Error performing web search: {str(e)}"

duckduckgo_tool = LangchainTool(
    tool=StructuredTool.from_function(
        func=duckduckgo_search_function,
        name="duckduckgo_search",
        description="Search the web using DuckDuckGo. Input is a search query string. Returns a list of search results, each with 'title', 'link', and 'snippet' fields."
    )
)

# --------------------------------------------------
# SUB-AGENT: INTERNET RESEARCH SPECIALIST
# --------------------------------------------------
internet_agent = Agent(
    name="internet_agent",
    description="Web search specialist that searches the internet and returns formatted responses with clickable website links.",
    model=azure_openai_model,
    tools=[duckduckgo_tool],
    instruction="""You are a web search agent. Your job is to search the internet and format responses with sources.

PROCESS:
1. Call duckduckgo_search with a well-crafted query
2. Analyze ALL search results (list of dicts with 'title', 'link', 'snippet' fields)
3. Synthesize an answer from the snippets - use information from multiple sources if relevant
4. Format the response EXACTLY as shown below
5. Call transfer_to_agent(agent_name='manager_agent')

CRITICAL: YOU MUST FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**Answer:**
[Your answer here - write naturally without any [1], [2], [3] citation numbers]

**Sources:**
SOURCE_START
title: Exact title from search result
url: https://exact-url-from-link-field.com
SOURCE_END

SOURCE_START
title: Another exact title from search result
url: https://another-url-from-link-field.com
SOURCE_END

SOURCE_START
title: Third title from search result
url: https://third-url.com
SOURCE_END

MANDATORY RULES:
1. DO NOT put [1], [2], [3] anywhere in the **Answer:** section
2. Write the answer in plain natural language
3. List ALL sources you used in the **Sources:** section
4. Each source MUST be wrapped in SOURCE_START and SOURCE_END markers
5. Each source MUST have "title: " and "url: " on separate lines
6. Use the exact 'title' and 'link' from the search results
7. Include ALL relevant sources (typically 3-5 sources)

EXAMPLE OF CORRECT FORMAT:

**Answer:**
The top 5 IMDb TV shows, based on ratings and popularity across recent sources, are Breaking Bad, Band of Brothers, Planet Earth II, Planet Earth, and The Wire. These series are consistently recognized for their high ratings and acclaim on IMDb.

**Sources:**
SOURCE_START
title: TV Series (Sorted by Popularity Ascending) - IMDb
url: https://www.imdb.com/search/title/?title_type=tv_series
SOURCE_END

SOURCE_START
title: Top 25 highest rated TV series (IMDb) : r/television - Reddit
url: https://www.reddit.com/r/television/comments/xyz/top_25_highest_rated
SOURCE_END

SOURCE_START
title: TV Series. Number of votes at least 1000, English (Sorted by ...) - IMDb
url: https://www.imdb.com/search/title/?num_votes=1000
SOURCE_END

SOURCE_START
title: Most Popular TV Shows of 2025 - IMDb
url: https://www.imdb.com/chart/tvmeter
SOURCE_END

After formatting the response, call:
transfer_to_agent(agent_name='manager_agent')"""
)