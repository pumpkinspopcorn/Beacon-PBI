# PBI Beacon

This project implements an AI Orchestration system using the **Agno** framework.

## Structure

- `cli.py`: Command Line Interface for testing the agents.
- `backend/`: Core logic.
  - `orchestrator.py`: Agno Team acting as the central hub.
  - `agents/`:
    - `internet_agent.py`: Agno Agent with DuckDuckGo search.
    - `rag_agent.py`: Agno Agent with **Azure AI Search**.
  - `models/`:
    - `llm_client.py`: Configures the LLM (Groq with `moonshotai/kimi-k2-instruct-0905`).

## Prerequisites

- Python 3.9+
- Groq API Key
- Azure AI Search Service (Endpoint, Key, and Index Name)

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables:
   - Copy `env.example` to `.env`.
   - Add your keys:
     ```
     GROQ_API_KEY=...
     AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
     AZURE_SEARCH_KEY=...
     AZURE_SEARCH_INDEX_NAME=your-index-name
     ```

## Running the App

Run the CLI for testing:

```bash
python cli.py
```
