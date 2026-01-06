# PBI Beacon - Power BI AI Assistant

An intelligent Power BI assistant using Google ADK (Agent Development Kit) with a team of specialized agents that work together to answer questions using web search, internal documents, and community knowledge.

## Features

- **Power BI Assistant**: User-focused AI assistant that helps with Power BI questions and troubleshooting
- **Internet Search**: Real-time web search using DuckDuckGo with actual URLs
- **Semantic Search**: Hybrid search (vector + keyword + semantic) using Azure AI Search
- **RAG Agent**: Search internal documents with relevance scoring
- **Community Agent**: Search community discussions and forum posts
- **Source Citations**: Displays file sources and web URLs for transparency
- **Modern UI**: React-based frontend with real-time chat interface

## Architecture

The system uses a coordinator pattern where a manager agent intelligently delegates questions to specialized sub-agents:

- **Manager Agent**: Power BI assistant that routes questions and formats responses
- **Internet Agent**: Performs web searches and returns structured results with URLs
- **RAG Agent**: Searches internal knowledge base using semantic search
- **Community Agent**: Searches community discussions using semantic search

## Prerequisites

### Backend Requirements
- Python 3.9+
- Groq API Key (for LLM)
- Azure OpenAI (for embeddings)
- Azure AI Search Service (for RAG and Community search)
  - Endpoint
  - API Key
  - Index Names
  - Semantic Configuration

### Frontend Requirements
- Node.js 18+ and npm

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/pumpkinspopcorn/Beacon-PBI.git
cd Beacon-PBI
```

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the project root:
```bash
cd ..
# Copy the example file
cp .env.example .env
```

5. Add your API keys and configuration to `.env`:
```env
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Azure OpenAI Configuration (for embeddings)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your_azure_openai_key_here
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# Azure AI Search Configuration (Main RAG Index)
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_KEY=your_search_key_here
AZURE_SEARCH_INDEX=your_index_name
AZURE_SEARCH_SEMANTIC_CONFIG=your_semantic_config_name
AZURE_SEARCH_VECTOR_FIELD=text_vector

# Azure AI Search Configuration (Community Index)
AZURE_SEARCH_ENDPOINT_COMM=https://your-search-service.search.windows.net
AZURE_SEARCH_KEY_COMM=your_search_key_here
AZURE_SEARCH_INDEX_COMM=your_community_index_name
AZURE_SEARCH_SEMANTIC_CONFIG_COMM=your_community_semantic_config_name
```

### 3. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd myf
```

2. Install Node.js dependencies:
```bash
npm install
```

## Running the Application

### Start Backend Server

1. Navigate to the backend directory:
```bash
cd backend
```

2. Activate your virtual environment (if using one):
```bash
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate
```

3. Start the API server:
```bash
python run_api.py
```

The backend API will start on `http://localhost:8000`
- API docs available at: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### Start Frontend Server

1. Navigate to the frontend directory:
```bash
cd myf
```

2. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:8080`

The frontend automatically proxies API requests to the backend server.

## Usage

1. **Start both servers** (backend and frontend) as described above
2. **Open your browser** and navigate to `http://localhost:8080`
3. **Ask questions** in the chat interface:
   - Click one of the quick action buttons (Error Agent, Performance Issues, etc.) to get started
   - Or type your own question about Power BI
   - The assistant will automatically route your question to the appropriate agent:
     - Latest Power BI updates, news → Internet Agent (with web URLs)
     - Internal documentation questions → RAG Agent (with file citations)
     - Community discussions → Community Agent (with discussion sources)
     - Simple questions → Answered directly by the assistant

## Key Features

### Semantic Search
- Uses Azure OpenAI embeddings for semantic understanding
- Hybrid search combines vector similarity + keyword matching + semantic ranking
- Returns relevance scores for each result

### Source Citations
- Web sources: Clickable URLs from internet searches
- Internal documents: File names from your knowledge base
- Community discussions: Discussion file references
- All sources displayed in the Sources panel

### User-Focused Assistant
- Asks clarifying questions when needed
- Provides step-by-step guidance
- Acknowledges frustrations and offers help
- Transparent about what was searched and found

## API Endpoints

- `POST /api/ask` - Ask a question (returns answer with sources)
- `GET /api/health` - Health check
- `GET /api/observability/stats` - Get observability statistics
- `GET /api/observability/recent` - Get recent requests
- `POST /api/observability/reset` - Reset statistics

## Project Structure

```
PBI-beacon/
├── backend/
│   ├── Agents/
│   │   ├── team.py              # Manager agent (coordinator)
│   │   ├── internet_agent.py   # Web search with DuckDuckGo
│   │   ├── rag_agent.py        # Internal docs semantic search
│   │   ├── community_agent.py  # Community semantic search
│   │   ├── config.py           # Configuration
│   │   ├── observability.py    # Observability tracking
│   │   └── source_extractor.py # Extract sources from responses
│   ├── api.py                  # FastAPI server
│   ├── run_api.py              # Server entry point
│   └── requirements.txt        # Python dependencies
├── myf/                         # Frontend React app
│   ├── src/
│   │   ├── pages/Index.tsx     # Main chat interface
│   │   ├── components/chat/    # Chat components
│   │   └── ...
│   └── package.json
├── .env                         # Environment variables (create from .env.example)
├── .env.example                 # Example environment variables
└── README.md                    # This file
```

## Troubleshooting

### Backend Issues

- **"GROQ_API_KEY not found"**: Make sure your `.env` file is in the project root and contains all required keys
- **Azure OpenAI errors**: Verify your Azure OpenAI endpoint and key are correct
- **Azure Search errors**: Check that your search service endpoint, key, and index names are correct
- **Port 8000 already in use**: Change the port in `backend/run_api.py`
- **Import errors**: Make sure you've activated your virtual environment and installed all dependencies

### Frontend Issues

- **Cannot connect to backend**: Ensure the backend is running on `http://localhost:8000`
- **Port 8080 already in use**: Change the port in `myf/vite.config.ts`
- **npm install fails**: Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

## Development

### Testing Agents

You can test individual agents directly:

```bash
cd backend
python -m Agents.team  # Test the full team
```

### Dependencies

Key Python packages:
- `google-adk` - Google Agent Development Kit
- `langchain-openai` - Azure OpenAI integration
- `langchain-community` - Community tools (DuckDuckGo, Azure Search)
- `azure-search-documents` - Azure AI Search SDK
- `fastapi` - Web API framework
- `litellm` - LLM abstraction layer

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

