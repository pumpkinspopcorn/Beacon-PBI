"""
Script to run the API server
"""
import os
import uvicorn

if __name__ == "__main__":
    # Ensure GROQ_API_KEY is set
    if not os.getenv("GROQ_API_KEY"):
        print("Warning: GROQ_API_KEY environment variable not set")
    
    # Run the API server
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable auto-reload during development
    )

