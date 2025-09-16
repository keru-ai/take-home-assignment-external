"""
Vector Search Engine for SEC Documents API.
Provides semantic similarity search using embeddings.
"""

import time
import logging
from typing import List, Optional, Dict, Any
import duckdb
import pandas as pd
import os

from search_models import VectorSearchRequest, SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)


class VectorSearchEngine:
    """Vector similarity search engine using DuckDB VSS and OpenAI embeddings."""
    
    def __init__(self, db_connection: duckdb.DuckDBPyConnection):
        """
        Initialize vector search engine.
        
        Args:
            db_connection: DuckDB database connection
        """
        self.conn = db_connection
        self.embedding_dimensions = 1536  # text-embedding-3-small dimensions
        
        self.vss_available = self._check_vss_availability()
        self.embeddings_available = self._check_embeddings_availability()
        self.openai_client = self._init_openai_client()
        
        if self.vector_available:
            logger.info("✅ Vector search engine initialized successfully")
        else:
            logger.warning("⚠️ Vector search not fully available - check embeddings and OpenAI API key")
    
    @property
    def vector_available(self) -> bool:
        """Check if vector search is fully available."""
        return (self.vss_available and 
                self.embeddings_available and 
                self.openai_client is not None)
    
    def _check_vss_availability(self) -> bool:
        """Check if VSS extension is loaded."""
        try:
            # Try a simple vector operation
            self.conn.execute("SELECT 1").fetchone()
            return True
        except Exception:
            return False
    
    def _check_embeddings_availability(self) -> bool:
        """Check if embeddings are available in the database."""
        try:
            count = self.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
            return count > 0
        except Exception:
            return False
    
    def _init_openai_client(self) -> Optional[object]:
        """Initialize OpenAI client for query embeddings."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        
        try:
            import openai
            return openai.OpenAI(api_key=api_key)
        except ImportError:
            logger.warning("OpenAI library not installed")
            return None
        except Exception as e:
            logger.warning(f"Could not initialize OpenAI client: {e}")
            return None
    
    def search_chunks(self, request: VectorSearchRequest) -> SearchResponse:
        """
        Search chunks using vector similarity.
        
        Args:
            request: Vector search request parameters
            
        Returns:
            Search response with results
        """
        start_time = time.time()
        
        if not self.vector_available:
            return SearchResponse(
                query=request.query,
                method="vector",
                total_results=0,
                results=[],
                explanation={
                    "error": "Vector search not available",
                    "vss_available": self.vss_available,
                    "embeddings_available": self.embeddings_available,
                    "openai_available": self.openai_client is not None
                }
            )
        
        try:
            # Generate query embedding
            query_embedding = self._generate_query_embedding(request.query)
            if not query_embedding:
                return SearchResponse(
                    query=request.query,
                    method="vector",
                    total_results=0,
                    results=[],
                    explanation={"error": "Could not generate query embedding"}
                )
            
            # Perform vector search
            results_df = self._search_vectors(request, query_embedding)
            
            # Convert to response format
            search_results = self._format_results(results_df, request.query, request.include_distances)
            
            search_time = (time.time() - start_time) * 1000
            
            return SearchResponse(
                query=request.query,
                method="vector",
                total_results=len(search_results),
                results=search_results,
                search_time_ms=round(search_time, 2)
            )
            
        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return SearchResponse(
                query=request.query,
                method="vector",
                total_results=0,
                results=[],
                explanation={"error": str(e)}
            )
    
    def _generate_query_embedding(self, query: str) -> Optional[List[float]]:
        raise NotImplementedError("The method _generate_query_embedding is not yet implemented.")
    
    def _search_vectors(self, request: VectorSearchRequest, query_embedding: List[float]) -> pd.DataFrame:
        """Perform vector similarity search."""
        
        base_query = f"""
            SELECT 
                c.chunk_id,
                d.cik,
                d.filename,
                c.section_id,
                s.section_name,
                c.chunk_text,
                c.char_count,
                array_cosine_distance(e.embedding, $1::FLOAT[{self.embedding_dimensions}]) AS distance
            FROM chunks c
            JOIN sections s ON c.section_id = s.section_id
            JOIN documents d ON c.doc_id = d.doc_id
            JOIN embeddings e ON c.chunk_id = e.chunk_id
        """
        
        params = [query_embedding]
        conditions = []
        
        # Add filters
        if request.tickers:
            ciks = self._lookup_ciks_for_tickers(request.tickers)
            if ciks:
                cik_placeholders = ','.join('?' for _ in ciks)
                conditions.append(f"d.cik IN ({cik_placeholders})")
                params.extend(ciks)
            else:
                return pd.DataFrame()
        
        if request.ciks:
            cik_placeholders = ','.join('?' for _ in request.ciks)
            conditions.append(f"d.cik IN ({cik_placeholders})")
            params.extend(request.ciks)
        
        if request.max_distance:
            conditions.append("array_cosine_distance(e.embedding, $1) <= ?")
            params.append(request.max_distance)
        
        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)
        
        base_query += " ORDER BY distance ASC LIMIT ?"
        params.append(request.limit)
        
        return self.conn.execute(base_query, params).df()
    
    def _lookup_ciks_for_tickers(self, tickers: List[str]) -> List[str]:
        """Look up CIKs for ticker symbols."""
        if not tickers:
            return []
        
        ticker_placeholders = ','.join('?' for _ in tickers)
        upper_tickers = [ticker.upper() for ticker in tickers]
        
        try:
            result = self.conn.execute(f"""
                SELECT DISTINCT cik
                FROM company_tickers_exchange 
                WHERE UPPER(ticker) IN ({ticker_placeholders})
            """, upper_tickers).fetchall()
            
            return [str(row[0]) for row in result]
        except Exception:
            return []
    
    def _format_results(self, results_df: pd.DataFrame, query: str, include_distances: bool) -> List[SearchResultItem]:
        """Format search results into response model."""
        if len(results_df) == 0:
            return []
        
        search_results = []
        
        for _, row in results_df.iterrows():
            # Get company name
            company_name = self._get_company_name(row.get('cik'))
            
            # Convert distance to similarity score (0-1, higher is more similar)
            distance = float(row.get('distance', 1.0))
            similarity_score = max(0, 1.0 - distance)
            
            result_item = SearchResultItem(
                chunk_id=row.get('chunk_id', ''),
                doc_id=row.get('cik', '') + "_2019",
                cik=str(row.get('cik', '')),
                company_name=company_name,
                filename=row.get('filename', ''),
                section_name=row.get('section_name', ''),
                chunk_text=row.get('chunk_text', ''),
                char_count=int(row.get('char_count', 0)),
                vector_score=similarity_score,
                distance=distance if include_distances else None
            )
            
            search_results.append(result_item)
        
        return search_results
    
    def _get_company_name(self, cik: str) -> Optional[str]:
        """Get company name from CIK."""
        if not cik:
            return None
            
        try:
            result = self.conn.execute("""
                SELECT name FROM company_tickers_exchange 
                WHERE cik = ? LIMIT 1
            """, [cik]).fetchone()
            
            return result[0] if result else None
        except Exception:
            return None
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Get vector search capabilities and status."""
        try:
            chunks_count = self.conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            embeddings_count = self.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
            
            return {
                "vector_available": self.vector_available,
                "vss_extension": self.vss_available,
                "embeddings_available": self.embeddings_available,
                "openai_available": self.openai_client is not None,
                "total_chunks": chunks_count,
                "total_embeddings": embeddings_count,
                "embedding_dimensions": self.embedding_dimensions,
                "distance_metric": "cosine",
                "features": [
                    "Semantic similarity search",
                    "HNSW vector indexing",
                    "Configurable distance thresholds",
                    "OpenAI text-embedding-3-small model"
                ]
            }
        except Exception as e:
            return {"error": str(e)}
    
    def test_search(self, test_query: str = "artificial intelligence") -> Dict[str, Any]:
        """Test vector search functionality."""
        try:
            request = VectorSearchRequest(query=test_query, limit=3)
            response = self.search_chunks(request)
            
            return {
                "test_query": test_query,
                "method": "vector",
                "results_found": response.total_results,
                "search_time_ms": response.search_time_ms,
                "vector_working": self.vector_available,
                "avg_similarity": None if not response.results else 
                    sum(r.vector_score or 0 for r in response.results) / len(response.results)
            }
        except Exception as e:
            return {
                "test_query": test_query,
                "error": str(e),
                "vector_working": False
            }
