# SEC Document Search - Engineering Assessment

## Background

The project involves working with SEC 10-K filings, which are comprehensive annual reports filed by public companies. These documents provide a detailed overview of a company's financial performance, including business descriptions, risk factors, financial analysis, and other structured data. 10-K filings are crucial for investors and analysts as they offer insights into a company's operations and financial health. However, they can be cumbersome to work with due to their length and complexity, often spanning hundreds of pages with dense financial and legal jargon. This assessment is designed to build a basic document search interface to help navigate and extract relevant information from these extensive reports more efficiently within a 3-hour timeframe.

## Git LFS Setup

Git LFS (Large File Storage) is an extension for Git that allows you to manage large files efficiently by replacing them in your repository with lightweight references. The actual file content is stored on a remote server. In this project, the database files located inside the `db` directory are managed using Git LFS. This approach is particularly useful for handling these large database files, as it keeps your repository size manageable and improves performance. Before cloning or working with this repo:

1. **Install Git LFS** (if not already installed):
   ```bash
   # macOS
   brew install git-lfs

   # Ubuntu/Debian
   sudo apt install git-lfs

   # Windows
   # Download from https://git-lfs.github.io/
   ```

2. **Initialize Git LFS** in your local repository:
   ```bash
   git lfs install
   ```

3. **Clone the repository** (LFS files will be downloaded automatically):
   ```bash
   git clone <repository-url>
   cd take-home-assignment-external
   ```

   Or if you've already cloned without LFS, pull the LFS files:
   ```bash
   git lfs pull
   ```

**What's already built:**
- FastAPI backend with document storage and search endpoints (full-text, vector, hybrid)
- Basic React frontend that calls a few API endpoints
- 18 major companies' 2019 10-K filings with parsed sections (including AMZN, AAPL, MSFT, GOOGL, TSLA, META, NVDA, and others)
- Pre-computed document embeddings for vector search using OpenAI's embedding models
- DuckDB database with structured company metadata and document content

## Your Task (Estimated Time: ~3 hours)

Your task is to build a simple web application. This involves implementing the following core features:

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
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e ".[dev]"
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

### Data Structure

The dataset includes 18 major public companies' 2019 10-K filings, parsed into structured sections:

- **Companies**: AMZN, AAPL, MSFT, GOOGL, TSLA, META, NVDA, ORCL, WMT, JPM, V, LLY, BRK-B, and others
- **Document Sections**: Each 10-K is broken down into standard sections like:
  - Business descriptions and operations
  - Risk factors and forward-looking statements
  - Management discussion & analysis (MD&A)
  - Financial statements and notes
  - Legal proceedings and regulatory matters
  - Corporate governance and executive compensation

- **Search Capabilities**:
  - **Full-text search**: Traditional keyword matching across document content
  - **Vector search**: Semantic similarity using OpenAI embeddings for concept-based queries
  - **Hybrid search**: Combines both approaches for comprehensive results

The DuckDB database contains both company metadata and the full document content with pre-computed embeddings, enabling fast retrieval and semantic search across millions of words of financial disclosures.

## Notes

- AI coding tools are fine, but be ready to explain any generated code.
- The existing demo app shows basic API usage patterns.
- You may not be able to hit all of the objectives in 3 hours. That's ok. Focus on the pieces that will show off your strengths and create a cohesive experience.

## Questions?

If you hit issues with setup or API behavior, just ask: recruiting@keru.ai

## Hints

### Exploring DuckDB Files

This project uses DuckDB, a fast in-process analytical database, to store company metadata and document content. You can explore the database files interactively using DuckDB's built-in UI:

```bash
# Install DuckDB (if not already installed)
# macOS
brew install duckdb

# Ubuntu/Debian
sudo apt install duckdb

# Windows - download from https://duckdb.org/docs/installation/

# Launch DuckDB UI to explore the database
duckdb -ui db/company_metadata_and_docs.duckdb
```

This will open a web interface (usually at `http://localhost:3000`) where you can:
- Browse tables and schemas
- Run SQL queries interactively
- Visualize query results
- Explore the data structure

### About DuckDB

DuckDB is an embedded analytical database designed for fast analytical queries. Key features:
- **Columnar storage**: Optimized for analytical workloads
- **Embedded**: No server setup required - runs in-process
- **SQL compatible**: Standard SQL syntax with analytical extensions
- **Fast**: Vectorized execution engine for high performance
- **Python/R integration**: Native bindings for data science workflows

In this project, DuckDB stores:
- Company metadata (tickers, names, CIK numbers)
- Parsed 10-K document sections with full text content
- Pre-computed OpenAI embeddings for vector search

Useful SQL queries to explore the data:
```sql
-- See available tables
SHOW TABLES;

-- Browse companies
SELECT * FROM companies LIMIT 10;

-- Check document sections
SELECT company_name, section_name, LENGTH(content) as content_length
FROM documents
ORDER BY content_length DESC
LIMIT 10;
```
