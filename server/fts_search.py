"""
Full-Text Search Engine for SEC Documents API.
Provides improved DuckDB FTS search capabilities.
"""

import time
import logging
from typing import List, Optional, Dict, Any
import duckdb
import pandas as pd

from search_models import FTSSearchRequest, SearchResponse, SearchResultItem, SearchCapabilities

logger = logging.getLogger(__name__)


class FTSSearchEngine:
    """Full-text search engine using DuckDB FTS with BM25 ranking."""
    
    def __init__(self, db_connection: duckdb.DuckDBPyConnection):
        """
        Initialize FTS search engine.
        
        Args:
            db_connection: DuckDB database connection
        """
        self.conn = db_connection
        self.fts_available = self._check_fts_availability()
        
        if self.fts_available:
            logger.info("✅ FTS engine initialized successfully")
        else:
            logger.warning("⚠️ FTS extension not available - falling back to LIKE search")
    
    def _check_fts_availability(self) -> bool:
        """Check if FTS extension is available and indexes exist."""
        try:
            # Try a simple FTS query to verify functionality
            result = self.conn.execute("""
                SELECT COUNT(*) FROM (
                    SELECT fts_main_chunks.match_bm25(chunk_id, 'test') as score
                    FROM chunks
                    LIMIT 1
                ) test_query WHERE score IS NULL
            """).fetchone()
            return True
        except Exception as e:
            logger.debug(f"FTS availability check failed: {e}")
            return False
    
    def search_chunks(self, request: FTSSearchRequest) -> SearchResponse:
        """
        Search chunks using full-text search.
        
        Args:
            request: FTS search request parameters
            
        Returns:
            Search response with results
        """
        start_time = time.time()
        
        try:
            if self.fts_available:
                results_df = self._search_fts(request)
            else:
                results_df = self._search_like_fallback(request)
            
            # Convert to response format
            search_results = self._format_results(results_df, request.query)
            
            search_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            return SearchResponse(
                query=request.query,
                method="fts",
                total_results=len(search_results),
                results=search_results,
                search_time_ms=round(search_time, 2)
            )
            
        except Exception as e:
            logger.error(f"FTS search error: {e}")
            return SearchResponse(
                query=request.query,
                method="fts",
                total_results=0,
                results=[],
                explanation={"error": str(e)}
            )
    
    def _search_fts(self, request: FTSSearchRequest) -> pd.DataFrame:
        """Perform FTS search using improved single match_bm25 call."""
        
        # Build the base query with improved structure
        base_query = """
            SELECT 
                chunk_id, cik, filename, section_name, chunk_text, char_count, score
            FROM (
                SELECT 
                    c.chunk_id,
                    d.cik,
                    d.filename,
                    s.section_name,
                    c.chunk_text,
                    c.char_count,
                    fts_main_chunks.match_bm25(c.chunk_id, ?) as score
                FROM chunks c
                JOIN sections s ON c.section_id = s.section_id
                JOIN documents d ON c.doc_id = d.doc_id
            ) search_results
            WHERE score IS NOT NULL
        """
        
        params = [request.query]
        conditions = []
        
        # Add filters
        if request.tickers:
            # Convert tickers to CIKs
            ciks = self._lookup_ciks_for_tickers(request.tickers)
            if ciks:
                cik_placeholders = ','.join('?' for _ in ciks)
                conditions.append(f"cik IN ({cik_placeholders})")
                params.extend(ciks)
            else:
                # No valid CIKs found
                return pd.DataFrame()
        
        if request.ciks:
            cik_placeholders = ','.join('?' for _ in request.ciks)
            conditions.append(f"cik IN ({cik_placeholders})")
            params.extend(request.ciks)
        
        if request.min_score:
            conditions.append("score >= ?")
            params.append(request.min_score)
        
        # Add WHERE conditions if any filters
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        base_query += " ORDER BY score DESC LIMIT ?"
        params.append(request.limit)
        
        return self.conn.execute(base_query, params).df()
    
    def _search_like_fallback(self, request: FTSSearchRequest) -> pd.DataFrame:
        """Fallback search using LIKE when FTS is not available."""
        
        query = f"""
            SELECT 
                c.chunk_id,
                d.cik,
                d.filename,
                s.section_name,
                c.chunk_text,
                c.char_count,
                NULL as score
            FROM chunks c
            JOIN sections s ON c.section_id = s.section_id
            JOIN documents d ON c.doc_id = d.doc_id
            WHERE c.chunk_text ILIKE ?
        """
        
        params = [f"%{request.query}%"]
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
        
        if conditions:
            query += " AND " + " AND ".join(conditions)
        
        query += " LIMIT ?"
        params.append(request.limit)
        
        return self.conn.execute(query, params).df()
    
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
    
    def _format_results(self, results_df: pd.DataFrame, query: str) -> List[SearchResultItem]:
        """Format search results into response model."""
        if len(results_df) == 0:
            return []
        
        search_results = []
        
        for _, row in results_df.iterrows():
            # Get company name
            company_name = self._get_company_name(row.get('cik'))
            
            result_item = SearchResultItem(
                chunk_id=row.get('chunk_id', ''),
                doc_id=row.get('cik', '') + "_2019",  # Reconstruct doc_id
                cik=str(row.get('cik', '')),
                company_name=company_name,
                filename=row.get('filename', ''),
                section_name=row.get('section_name', ''),
                chunk_text=row.get('chunk_text', ''),
                char_count=int(row.get('char_count', 0)),
                fts_score=float(row['score']) if row.get('score') is not None else None
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
        """Get FTS engine capabilities and status."""
        try:
            chunks_count = self.conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            
            return {
                "fts_available": self.fts_available,
                "total_chunks": chunks_count,
                "search_method": "BM25" if self.fts_available else "LIKE",
                "features": [
                    "English stemming",
                    "Stopwords filtering", 
                    "BM25 ranking" if self.fts_available else "Basic text matching"
                ]
            }
        except Exception as e:
            return {"error": str(e)}
    
    def test_search(self, test_query: str = "revenue") -> Dict[str, Any]:
        """Test FTS functionality with a simple query."""
        try:
            request = FTSSearchRequest(query=test_query, limit=3)
            response = self.search_chunks(request)
            
            return {
                "test_query": test_query,
                "method": "fts",
                "results_found": response.total_results,
                "search_time_ms": response.search_time_ms,
                "fts_working": self.fts_available
            }
        except Exception as e:
            return {
                "test_query": test_query,
                "error": str(e),
                "fts_working": False
            }
