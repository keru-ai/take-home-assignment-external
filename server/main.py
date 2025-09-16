"""FastAPI Server for SEC Documents and Company Metadata

A FastAPI server providing access to SEC filing documents and company metadata
stored in DuckDB, with endpoints for metadata lookups and document search.
"""

import os
import sys
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

# Load environment variables from .env file in project root
try:
    from dotenv import load_dotenv
    load_dotenv("../.env")  # Load from project root relative to server/
except ImportError:
    # dotenv not available - environment variables must be set manually
    pass

import duckdb
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import search functionality
try:
    from search_models import *
    from fts_search import FTSSearchEngine
    from vector_search import VectorSearchEngine  
    from hybrid_search import HybridSearchEngine
    SEARCH_AVAILABLE = True
    logger.info("✅ Search engines imported successfully")
except Exception as e:
    SEARCH_AVAILABLE = False
    logger.warning(f"⚠️ Search engines not available: {e}")
    logger.warning("   Advanced search endpoints will be disabled")

# Global database connection and search engines
db_conn = None
fts_search_engine = None
vector_search_engine = None
hybrid_search_engine = None

# Database path - relative to the server directory
DB_PATH = "../db/company_metadata_and_docs.duckdb"


# Pydantic response models
class HealthResponse(BaseModel):
    status: str
    message: str


class HelloResponse(BaseModel):
    message: str
    status: str = "success"


class CompanyTickerExchange(BaseModel):
    cik: int
    name: str
    ticker: str
    exchange: str


class CompanyTicker(BaseModel):
    index_key: int
    cik: int
    ticker: str
    title: str


class DocumentMetadata(BaseModel):
    doc_id: str
    cik: str
    filename: str
    year: int
    file_path: str
    total_sections: int
    total_chars: int
    ingested_at: str
    processor_version: str


class DatabaseStats(BaseModel):
    company_tickers_exchange: int
    company_tickers: int
    documents: int
    sections: int
    chunks: int
    embeddings: int


class SearchResult(BaseModel):
    doc_id: str
    cik: str
    filename: str
    year: int
    company_name: str
    section_name: str
    content_snippet: str
    char_count: int
    search_score: Optional[float] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown of the application."""
    # Startup: Initialize database connection and search engines
    global db_conn, fts_search_engine, vector_search_engine, hybrid_search_engine
    
    try:
        db_path = Path(DB_PATH)
        if not db_path.exists():
            raise FileNotFoundError(f"Database file not found: {DB_PATH}")
        
        logger.info(f"Connecting to database: {DB_PATH}")
        db_conn = duckdb.connect(DB_PATH, read_only=True)
        logger.info("✓ Database connected successfully")
        
        # Check if expected tables exist
        tables_query = "SELECT table_name FROM information_schema.tables"
        tables = [row[0] for row in db_conn.execute(tables_query).fetchall()]
        expected_tables = ['company_tickers_exchange', 'company_tickers', 'documents', 'sections', 'chunks', 'embeddings']
        
        missing_tables = [t for t in expected_tables if t not in tables]
        if missing_tables:
            logger.warning(f"⚠️ Missing expected tables: {missing_tables}")
        else:
            logger.info("✓ All expected tables found")
        
        # Initialize search engines if available
        if SEARCH_AVAILABLE:
            try:
                logger.info("🔍 Initializing search engines...")
                fts_search_engine = FTSSearchEngine(db_conn)
                vector_search_engine = VectorSearchEngine(db_conn)
                hybrid_search_engine = HybridSearchEngine(fts_search_engine, vector_search_engine)
                logger.info("✅ Search engines initialized successfully")
            except Exception as e:
                logger.warning(f"⚠️ Could not initialize search engines: {e}")
                fts_search_engine = vector_search_engine = hybrid_search_engine = None
            
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown: Close database connection
    if db_conn:
        db_conn.close()
        logger.info("✓ Database connection closed")


# Create FastAPI app instance
app = FastAPI(
    title="SEC Documents and Metadata API",
    description="FastAPI server providing access to SEC filing documents and company metadata",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Routes

@app.get("/", response_model=HelloResponse)
async def root() -> HelloResponse:
    """Root endpoint returning a welcome message."""
    return HelloResponse(message="Welcome to SEC Documents and Metadata API!")


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint that also verifies database connectivity."""
    try:
        if db_conn is None:
            return HealthResponse(
                status="unhealthy", 
                message="Database connection not initialized"
            )
        
        # Simple database connectivity check
        count = db_conn.execute("SELECT COUNT(*) FROM company_tickers_exchange").fetchone()[0]
        return HealthResponse(
            status="healthy",
            message=f"Server and database are running smoothly ({count} companies in database)"
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            message=f"Database error: {str(e)}"
        )


@app.get("/stats", response_model=DatabaseStats)
async def get_database_stats() -> DatabaseStats:
    """Get statistics about the database contents."""
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        # Get counts from each table
        stats = {}
        
        table_counts = [
            ("company_tickers_exchange", "SELECT COUNT(*) FROM company_tickers_exchange"),
            ("company_tickers", "SELECT COUNT(*) FROM company_tickers"),
            ("documents", "SELECT COUNT(*) FROM documents"),
            ("sections", "SELECT COUNT(*) FROM sections"),
            ("chunks", "SELECT COUNT(*) FROM chunks"),
            ("embeddings", "SELECT COUNT(*) FROM embeddings")
        ]
        
        for table_name, query in table_counts:
            try:
                count = db_conn.execute(query).fetchone()[0]
                stats[table_name] = count
            except Exception:
                stats[table_name] = 0
        
        return DatabaseStats(**stats)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting database stats: {str(e)}")


# Company Metadata Endpoints

@app.get("/companies/search", response_model=List[CompanyTickerExchange])
async def search_companies(
    name: Optional[str] = Query(None, description="Company name search term"),
    ticker: Optional[str] = Query(None, description="Ticker symbol search term"),
    cik: Optional[int] = Query(None, description="CIK (Central Index Key) number"),
    exchange: Optional[str] = Query(None, description="Exchange filter"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of results")
) -> List[CompanyTickerExchange]:
    """Search companies by name, ticker, CIK, or exchange."""
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        # Build dynamic query based on provided parameters
        where_conditions = []
        params = []
        
        if name:
            where_conditions.append("UPPER(name) LIKE UPPER(?)")
            params.append(f"%{name}%")
        
        if ticker:
            where_conditions.append("UPPER(ticker) LIKE UPPER(?)")
            params.append(f"%{ticker}%")
        
        if cik:
            where_conditions.append("cik = ?")
            params.append(cik)
        
        if exchange:
            where_conditions.append("UPPER(exchange) = UPPER(?)")
            params.append(exchange)
        
        if not where_conditions:
            raise HTTPException(status_code=400, detail="At least one search parameter must be provided")
        
        where_clause = " AND ".join(where_conditions)
        query = f"""
            SELECT cik, name, ticker, exchange 
            FROM company_tickers_exchange 
            WHERE {where_clause}
            ORDER BY name, ticker
            LIMIT ?
        """
        params.append(limit)
        
        result = db_conn.execute(query, params).fetchall()
        
        return [CompanyTickerExchange(
            cik=row[0], name=row[1], ticker=row[2], exchange=row[3]
        ) for row in result]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching companies: {str(e)}")


# Document Metadata Endpoints

@app.get("/documents/search", response_model=List[DocumentMetadata])
async def search_documents(
    tickers: Optional[str] = Query(None, description="Comma-separated ticker symbols"),
    ciks: Optional[str] = Query(None, description="Comma-separated CIK numbers"),
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of results")
) -> List[DocumentMetadata]:
    """Search documents by ticker symbols, CIKs, and/or year."""
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        # Build query conditions
        where_conditions = []
        params = []
        
        if tickers:
            # Parse ticker list and lookup CIKs
            ticker_list = [t.strip().upper() for t in tickers.split(',') if t.strip()]
            if ticker_list:
                ticker_placeholders = ','.join('?' for _ in ticker_list)
                cik_lookup_query = f"""
                    SELECT DISTINCT cik
                    FROM company_tickers_exchange 
                    WHERE UPPER(ticker) IN ({ticker_placeholders})
                """
                cik_result = db_conn.execute(cik_lookup_query, ticker_list).fetchall()
                
                if cik_result:
                    ticker_ciks = [str(row[0]) for row in cik_result]
                    cik_placeholders = ','.join('?' for _ in ticker_ciks)
                    where_conditions.append(f"d.cik IN ({cik_placeholders})")
                    params.extend(ticker_ciks)
                else:
                    # No CIKs found for any tickers
                    return []
        
        if ciks:
            # Parse CIK list
            cik_list = [c.strip() for c in ciks.split(',') if c.strip()]
            if cik_list:
                cik_placeholders = ','.join('?' for _ in cik_list)
                where_conditions.append(f"d.cik IN ({cik_placeholders})")
                params.extend(cik_list)
        
        if year:
            where_conditions.append("d.year = ?")
            params.append(year)
        
        if not where_conditions:
            raise HTTPException(status_code=400, detail="At least one search parameter must be provided")
        
        where_clause = " AND ".join(where_conditions)
        query = f"""
            SELECT d.doc_id, d.cik, d.filename, d.year, d.file_path, d.total_sections, 
                   d.total_chars, d.ingested_at, d.processor_version
            FROM documents d
            WHERE {where_clause}
            ORDER BY d.cik, d.year DESC, d.filename
            LIMIT ?
        """
        params.append(limit)
        
        result = db_conn.execute(query, params).fetchall()
        
        return [DocumentMetadata(
            doc_id=row[0], cik=row[1], filename=row[2], year=row[3],
            file_path=row[4], total_sections=row[5], total_chars=row[6],
            ingested_at=str(row[7]), processor_version=row[8]
        ) for row in result]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching documents: {str(e)}")

@app.get("/documents/{doc_id}", response_model=DocumentMetadata)
async def get_document_by_id(doc_id: str) -> DocumentMetadata:
    """Get document metadata by document ID."""
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        result = db_conn.execute("""
            SELECT doc_id, cik, filename, year, file_path, total_sections, 
                   total_chars, ingested_at, processor_version
            FROM documents 
            WHERE doc_id = ?
        """, [doc_id]).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Document not found: {doc_id}")
        
        return DocumentMetadata(
            doc_id=result[0], cik=result[1], filename=result[2], year=result[3],
            file_path=result[4], total_sections=result[5], total_chars=result[6],
            ingested_at=str(result[7]), processor_version=result[8]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying document by ID: {str(e)}")


# Search Endpoints

@app.post("/search/fts", response_model=SearchResponse)
async def search_full_text(request: FTSSearchRequest) -> SearchResponse:
    """
    Full-text search using DuckDB FTS with BM25 ranking.
    
    Features:
    - English stemming and stopwords
    - BM25 relevance ranking
    - Optimized single match_bm25 calls
    - Graceful fallback to LIKE search
    """
    if not SEARCH_AVAILABLE or not fts_search_engine:
        raise HTTPException(
            status_code=503,
            detail="FTS search not available - search engines not initialized"
        )
    
    try:
        return fts_search_engine.search_chunks(request)
    except Exception as e:
        logger.error(f"FTS search endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"FTS search error: {str(e)}")


@app.post("/search/vector", response_model=SearchResponse)
async def search_vector(request: VectorSearchRequest) -> SearchResponse:
    """
    Vector similarity search using OpenAI embeddings and DuckDB VSS.
    
    Features:
    - Semantic similarity matching
    - HNSW vector indexing
    - Configurable distance thresholds
    - OpenAI text-embedding-3-small model
    
    Requires:
    - OPENAI_API_KEY environment variable
    - Pre-generated embeddings in database
    """
    if not SEARCH_AVAILABLE or not vector_search_engine:
        raise HTTPException(
            status_code=503,
            detail="Vector search not available - search engines not initialized"
        )
    
    try:
        return vector_search_engine.search_chunks(request)
    except Exception as e:
        logger.error(f"Vector search endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Vector search error: {str(e)}")


@app.post("/search/hybrid", response_model=SearchResponse)
async def search_hybrid(request: HybridSearchRequest) -> SearchResponse:
    """
    Hybrid search combining FTS and Vector search with configurable weighting.
    
    Features:
    - Best of both keyword and semantic search
    - Configurable FTS/Vector weight balance
    - Score normalization and intelligent merging
    - Graceful degradation to available methods
    
    Default weights: 30% FTS + 70% Vector
    """
    if not SEARCH_AVAILABLE or not hybrid_search_engine:
        raise HTTPException(
            status_code=503,
            detail="Hybrid search not available - search engines not initialized"
        )
    
    try:
        return hybrid_search_engine.search_chunks(request)
    except Exception as e:
        logger.error(f"Hybrid search endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Hybrid search error: {str(e)}")


@app.get("/search/capabilities", response_model=SearchCapabilities)
async def get_search_capabilities() -> SearchCapabilities:
    """Get current search capabilities and status."""
    try:
        if not SEARCH_AVAILABLE:
            return SearchCapabilities(
                fts_available=False,
                vector_available=False,
                hybrid_available=False,
                fts_extension_loaded=False,
                vss_extension_loaded=False,
                total_chunks=0,
                total_embeddings=0
            )
        
        # Get capabilities from each engine
        fts_caps = fts_search_engine.get_capabilities() if fts_search_engine else {}
        vector_caps = vector_search_engine.get_capabilities() if vector_search_engine else {}
        hybrid_caps = hybrid_search_engine.get_capabilities() if hybrid_search_engine else {}
        
        # Get database counts
        chunks_count = db_conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0] if db_conn else 0
        embeddings_count = db_conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0] if db_conn else 0
        
        return SearchCapabilities(
            fts_available=fts_caps.get('fts_available', False),
            vector_available=vector_caps.get('vector_available', False),
            hybrid_available=hybrid_caps.get('hybrid_available', False),
            fts_extension_loaded=fts_caps.get('fts_available', False),
            vss_extension_loaded=vector_caps.get('vss_extension', False),
            total_chunks=chunks_count,
            total_embeddings=embeddings_count,
            embedding_model="text-embedding-3-small" if vector_caps.get('vector_available') else None,
            vector_dimensions=vector_caps.get('embedding_dimensions')
        )
        
    except Exception as e:
        logger.error(f"Search capabilities error: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting search capabilities: {str(e)}")


@app.post("/search/hybrid/explain")
async def search_hybrid_with_explanation(request: HybridSearchRequest) -> Dict[str, Any]:
    """
    Perform hybrid search with detailed explanation of the search process.
    
    Returns detailed breakdown of:
    - Query analysis
    - Search process steps
    - Result composition
    - Performance metrics
    """
    if not SEARCH_AVAILABLE or not hybrid_search_engine:
        raise HTTPException(
            status_code=503,
            detail="Hybrid search not available - search engines not initialized"
        )
    
    try:
        return hybrid_search_engine.search_with_explanation(request)
    except Exception as e:
        logger.error(f"Hybrid search explanation error: {e}")
        raise HTTPException(status_code=500, detail=f"Hybrid search explanation error: {str(e)}")

if __name__ == "__main__":
    # Run the server with uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload for development
        access_log=True
    )
