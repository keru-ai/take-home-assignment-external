#!/bin/bash
# Activation script for the FastAPI server environment

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment with Python 3.12..."
    python3.12 -m venv .venv || python3 -m venv .venv
    echo "Installing dependencies..."
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -e ".[dev]"
else
    source .venv/bin/activate
fi

echo "✅ FastAPI server environment activated!"
echo "📁 Current directory: $(pwd)"
echo "🐍 Python version: $(python --version)"
echo ""
echo "🚀 To start the FastAPI server:"
echo "  python main.py"
echo ""
echo "📚 API Documentation:"
echo "  http://localhost:8000/docs      # Swagger UI"
echo "  http://localhost:8000/redoc     # ReDoc"
echo ""
echo "🔗 API Endpoints:"
echo "  http://localhost:8000/          # Hello World"
echo "  http://localhost:8000/hello     # Simple greeting"
echo "  http://localhost:8000/health    # Health check"
