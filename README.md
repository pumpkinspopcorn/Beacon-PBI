# PBI Beacon

This project implements an AI Orchestration system using the **Google ADK** framework.

## Structure

- `cli.py`: Command Line Interface for testing the agents.
- `backend/`: Core logic.
  - `orchestrator.py`: Central coordinator agent using ReACT pattern.
  - `agents/`:
    - `internet_agent.py`: Real-time web search via DuckDuckGo.
    - `rag_agent.py`: Internal knowledge base via **Azure AI Search**.
    - `community_agent.py`: Web scraping & content extraction via **Firecrawl MCP**.
  - `models/`:
    - `llm_client.py`: Configures the LLM (Groq with `moonshotai/kimi-k2-instruct-0905`).

## Prerequisites

- Python 3.9+
- Node.js (for npx - required by Firecrawl MCP)
- Groq API Key ([Get one here](https://console.groq.com))
- Azure AI Search Service (Endpoint, Key, and Index Name)
- Firecrawl API Key ([Sign up here](https://firecrawl.dev))

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables:
   - Create a `.env` file in the project root.
   - Add your keys:
     ```
     # LLM Configuration
     GROQ_API_KEY=your_groq_api_key
     
     # Azure AI Search (RAG Agent)
     AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
     AZURE_SEARCH_KEY=your_azure_search_key
     AZURE_SEARCH_INDEX=your-index-name
     
     # Firecrawl (Community Agent)
     FIRECRAWL_API_KEY=your_firecrawl_api_key
     ```

## Running the App

Run the CLI for testing:

```bash
python cli.py
```
