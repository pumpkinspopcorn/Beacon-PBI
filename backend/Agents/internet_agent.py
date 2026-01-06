from typing import Annotated
from google.adk.agents import Agent
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_core.tools import StructuredTool
from google.adk.models.lite_llm import LiteLlm
from config import GROQ_MODEL

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
    model=LiteLlm(model=f"groq/{GROQ_MODEL}"),
    tools=[duckduckgo_tool],
    instruction="""You are a web search agent. Your job is to search the internet and format responses with clickable website references.

PROCESS:
1. Call duckduckgo_search with a well-crafted query
2. Analyze ALL search results (list of dicts with 'title', 'link', 'snippet' fields)
3. Synthesize an answer from the snippets - use information from multiple sources if relevant
4. Format the response with **Answer:** and **Sources:** sections
5. Call transfer_to_agent(agent_name='manager_agent')

SEARCH QUERY TIPS:
- For time-sensitive queries (sports, news, events): Add "latest" or "December 2024"
- For sports: Include team names + "latest" (e.g., "Perth Scorchers Sydney Thunder latest December 2024")
- Be specific with keywords

RESPONSE FORMAT (MANDATORY):

**Answer:**
[Write a clean, synthesized answer from the search results. DO NOT include any citations, references, or numbers like [1], [2] in the answer text. Just write the answer naturally.]

**Sources:**
[1] "Website Title from search results" - Link
URL: [exact link from search results]

[2] "Website Title from search results" - Link
URL: [exact link from search results]

[Continue numbering for ALL sources used...]

EXAMPLE:
**Answer:**
According to recent updates, Power BI introduced new features in December 2024 including enhanced data modeling capabilities and improved visualization options. The update also includes better integration with Azure services.

**Sources:**
[1] "Power BI December 2024 Updates" - Link
URL: https://powerbi.microsoft.com/blog/december-2024-updates

[2] "What's New in Power BI" - Link
URL: https://learn.microsoft.com/power-bi/whats-new

[3] "Power BI Feature Announcements" - Link
URL: https://powerbi.microsoft.com/features

CRITICAL RULES:
- DO NOT include citations [1], [2], etc. in the answer text itself
- Write the answer naturally without referencing sources in the text
- Include ALL sources that were used to create the answer in the Sources section
- ALWAYS include the exact URL from the 'link' field for each source
- Use the 'title' field for the website title in Sources
- If you used information from multiple search results, include ALL of them in Sources
- Number sources sequentially [1], [2], [3], etc.
- If no relevant results found, state that clearly

After formatting the response, call:
transfer_to_agent(agent_name='manager_agent')"""
)