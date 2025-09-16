# SEC Document Search - Engineering Assessment

## Background

We work with SEC 10-K filings (annual reports from public companies) that contain business descriptions, risk factors, financial analysis, and other structured data. This is a 3-hour assessment to build a basic document search interface.

**What's already built:**
- FastAPI backend with document storage and search endpoints (full-text, vector, hybrid)
- Basic React frontend that calls a few API endpoints
- 18 companies' 2019 10-K filings with parsed sections
- Pre-computed document embeddings for vector search

## Your Task (~3 hours)

Build a simple web app with these core features:

### 1. Company List
- Display available companies from the dataset that have data ingested
- Basic filtering/searching through company names

### 2. Document Browser  
- Show documents for a selected company
- Display document sections (Business, Risk Factors, etc.)
- Basic text display - no fancy formatting needed

### 3. Search Implementation
- Wire up the vector search endpoint (this is the main technical piece)
- Show search results with document excerpts
- Compare different search types if you have time (full-text vs vector vs hybrid)

### 4. Clean Presentation
- Simple, functional UI that works
- Search results should be readable and clearly organized

## Setup

### Backend
```bash
cd server/
./activate.sh  # Sets up Python environment and dependencies
python main.py # Starts server on http://localhost:8000
```

### Frontend  
```bash
cd app/
npm install
npm run dev    # Starts on http://localhost:5173
```

**API Documentation**: `http://localhost:8000/docs`

## Technical Details

**Stack**: FastAPI, React/TypeScript, DuckDB, OpenAI embeddings  
**Key API endpoints**: `/companies`, `/documents`, `/search/*`  
**Search types**: Full-text (`/search/fts`), Vector (`/search/vector`), Hybrid (`/search/hybrid`)

## Notes

- AI coding tools are fine, but be ready to explain any generated code
- The existing demo app shows basic API usage patterns
- You may not be able to hit all of the objectives in 3 hours. That's ok. Focus on the pieces that will show off your strengths and create a cohesive experience. 

## Questions?

If you hit issues with setup or API behavior, just ask.
