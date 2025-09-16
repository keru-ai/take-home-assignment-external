# FastAPI Server

A FastAPI server providing access to SEC filing documents and company metadata with search capabilities.

## Setup Environment

1. **Create a `.env` file** in the project root (one level up from this server directory):
   ```bash
   # In the project root directory
   touch ../.env
   ```

   Add your OpenAI API key to the `.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   > **Note**: The OpenAI API key is required for vector search functionality. Without it, only basic endpoints and full-text search will be available. When you submit your assignment however, don't submit your key!

2. **Set up the Python environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e ".[dev]"
   ```

   This will:
   - Create a virtual environment with your system Python (requires >=3.12)
   - Install all required dependencies including dev tools
   - Activate the environment

## Start the Server

```bash
python main.py
```

The server will start on `http://localhost:8000`

## API Documentation

Once the server is running, you can access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Quick Health Check

- **Health endpoint**: http://localhost:8000/health
- **Hello endpoint**: http://localhost:8000/hello

## Requirements

- Python 3.12 or higher
- All dependencies are managed via `pyproject.toml` and installed automatically by the activation script
