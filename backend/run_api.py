import os
import sys
from dotenv import load_dotenv

# Load .env file FIRST, before any other imports
# This ensures environment variables are available when modules are imported
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, '.env')

# Load environment variables from .env file
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
    print(f"Loaded .env file from: {env_path}")
    # Verify critical environment variables are loaded (without printing values)
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        print(f"✓ GROQ_API_KEY is loaded (length: {len(groq_key)} characters)")
    else:
        print("⚠ Warning: GROQ_API_KEY not found in environment variables")
else:
    print(f"Warning: .env file not found at: {env_path}")

# Set PYTHONPATH to include the current directory so imports inside Agents work
agents_dir = os.path.join(backend_dir, "Agents")
os.environ["PYTHONPATH"] = f"{agents_dir}{os.pathsep}{os.environ.get('PYTHONPATH', '')}"

if __name__ == "__main__":
    import uvicorn
    # Import app here so PYTHONPATH is already set and .env is loaded
    from api import app
    uvicorn.run(app, host="0.0.0.0", port=8000)
