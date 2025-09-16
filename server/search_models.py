"""
Pydantic models for search requests and responses.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Base search request model."""
    query: str = Field(..., description="Search query string")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")
    tickers: Optional[List[str]] = Field(None, description="Filter by specific ticker symbols")
    ciks: Optional[List[str]] = Field(None, description="Filter by specific CIK numbers")


class FTSSearchRequest(SearchRequest):
    """Full-text search request model."""
    min_score: Optional[float] = Field(None, ge=0, description="Minimum BM25 score threshold")


class VectorSearchRequest(SearchRequest):
    """Vector similarity search request model."""
    include_distances: bool = Field(True, description="Include similarity distances in results")
    max_distance: Optional[float] = Field(None, ge=0, le=2, description="Maximum cosine distance threshold")


class HybridSearchRequest(SearchRequest):
    """Hybrid search request model."""
    fts_weight: float = Field(0.3, ge=0, le=1, description="Weight for FTS scores (0-1)")
    semantic_weight: float = Field(0.7, ge=0, le=1, description="Weight for semantic scores (0-1)")
    normalize_scores: bool = Field(True, description="Whether to normalize scores before combining")


class SearchResultItem(BaseModel):
    """Individual search result item."""
    chunk_id: str
    doc_id: str
    cik: str
    company_name: Optional[str] = None
    filename: str
    section_name: str
    chunk_text: str
    char_count: int
    
    # Search-specific scores
    fts_score: Optional[float] = None
    vector_score: Optional[float] = None
    distance: Optional[float] = None
    combined_score: Optional[float] = None


class SearchResponse(BaseModel):
    """Search response model."""
    query: str
    method: str
    total_results: int
    results: List[SearchResultItem]
    
    # Search metadata
    search_time_ms: Optional[float] = None
    explanation: Optional[Dict[str, Any]] = None


class SearchCapabilities(BaseModel):
    """Server search capabilities status."""
    fts_available: bool
    vector_available: bool
    hybrid_available: bool
    
    # Extension status
    fts_extension_loaded: bool
    vss_extension_loaded: bool
    
    # Database statistics
    total_chunks: int
    total_embeddings: int
    
    # Configuration
    embedding_model: Optional[str] = None
    vector_dimensions: Optional[int] = None


class SearchErrorResponse(BaseModel):
    """Search error response model."""
    error: str
    detail: str
    suggestions: Optional[List[str]] = None
