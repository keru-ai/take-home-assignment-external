"""
Hybrid Search Engine for SEC Documents API.
Combines FTS and Vector search for optimal results.
"""

import time
import logging
from typing import List, Optional, Dict, Any
import pandas as pd

from search_models import HybridSearchRequest, SearchResponse, SearchResultItem
from fts_search import FTSSearchEngine
from vector_search import VectorSearchEngine

logger = logging.getLogger(__name__)


class HybridSearchEngine:
    """Hybrid search engine combining FTS and Vector search with configurable weighting."""
    
    def __init__(self, fts_engine: FTSSearchEngine, vector_engine: VectorSearchEngine):
        """
        Initialize hybrid search engine.
        
        Args:
            fts_engine: Full-text search engine instance
            vector_engine: Vector search engine instance
        """
        self.fts_engine = fts_engine
        self.vector_engine = vector_engine
        
        logger.info(f"✅ Hybrid search engine initialized (FTS: {fts_engine.fts_available}, Vector: {vector_engine.vector_available})")
    
    @property
    def hybrid_available(self) -> bool:
        """Check if hybrid search is available (at least FTS should work)."""
        return self.fts_engine.fts_available or self.vector_engine.vector_available
    
    def search_chunks(self, request: HybridSearchRequest) -> SearchResponse:
        """
        Search chunks using hybrid FTS + Vector approach.
        
        Args:
            request: Hybrid search request parameters
            
        Returns:
            Search response with combined results
        """
        start_time = time.time()
        
        # Validate weights
        total_weight = request.fts_weight + request.semantic_weight
        if total_weight <= 0:
            return SearchResponse(
                query=request.query,
                method="hybrid",
                total_results=0,
                results=[],
                explanation={"error": "Combined weights must be greater than 0"}
            )
        
        # Normalize weights
        fts_weight = request.fts_weight / total_weight
        semantic_weight = request.semantic_weight / total_weight
        
        try:
            # Get more results from each method for better combination
            search_limit = min(request.limit * 3, 100)
            
            # Get FTS results
            fts_results = []
            if self.fts_engine.fts_available and fts_weight > 0:
                from search_models import FTSSearchRequest
                fts_request = FTSSearchRequest(
                    query=request.query,
                    limit=search_limit,
                    tickers=request.tickers,
                    ciks=request.ciks
                )
                fts_response = self.fts_engine.search_chunks(fts_request)
                fts_results = fts_response.results
            
            # Get Vector results  
            vector_results = []
            if self.vector_engine.vector_available and semantic_weight > 0:
                from search_models import VectorSearchRequest
                vector_request = VectorSearchRequest(
                    query=request.query,
                    limit=search_limit,
                    tickers=request.tickers,
                    ciks=request.ciks,
                    include_distances=True
                )
                vector_response = self.vector_engine.search_chunks(vector_request)
                vector_results = vector_response.results
            
            # Combine results
            combined_results = self._combine_results(
                fts_results, vector_results, 
                fts_weight, semantic_weight, 
                request.normalize_scores
            )
            
            # Limit to requested number
            final_results = combined_results[:request.limit]
            
            search_time = (time.time() - start_time) * 1000
            
            return SearchResponse(
                query=request.query,
                method="hybrid",
                total_results=len(final_results),
                results=final_results,
                search_time_ms=round(search_time, 2),
                explanation={
                    "fts_weight": fts_weight,
                    "semantic_weight": semantic_weight,
                    "fts_results": len(fts_results),
                    "vector_results": len(vector_results),
                    "combined_unique": len(combined_results)
                }
            )
            
        except Exception as e:
            logger.error(f"Hybrid search error: {e}")
            return SearchResponse(
                query=request.query,
                method="hybrid",
                total_results=0,
                results=[],
                explanation={"error": str(e)}
            )
    
    def _combine_results(self, fts_results: List[SearchResultItem], 
                        vector_results: List[SearchResultItem],
                        fts_weight: float, semantic_weight: float,
                        normalize_scores: bool) -> List[SearchResultItem]:
        """
        Combine FTS and vector search results with weighted scoring.
        
        Args:
            fts_results: Results from FTS search
            vector_results: Results from vector search
            fts_weight: Weight for FTS scores
            semantic_weight: Weight for semantic scores
            normalize_scores: Whether to normalize scores
            
        Returns:
            Combined and ranked results
        """
        # Create a dictionary to track results by chunk_id
        combined_items: Dict[str, SearchResultItem] = {}
        
        # Process FTS results
        if fts_results and normalize_scores:
            max_fts_score = max((r.fts_score or 0) for r in fts_results)
            fts_normalizer = max_fts_score if max_fts_score > 0 else 1.0
        else:
            fts_normalizer = 1.0
        
        for result in fts_results:
            normalized_fts = (result.fts_score or 0) / fts_normalizer if normalize_scores else (result.fts_score or 0)
            
            # Create new result item with hybrid scoring
            combined_item = SearchResultItem(
                chunk_id=result.chunk_id,
                doc_id=result.doc_id,
                cik=result.cik,
                company_name=result.company_name,
                filename=result.filename,
                section_name=result.section_name,
                chunk_text=result.chunk_text,
                char_count=result.char_count,
                fts_score=normalized_fts,
                vector_score=0.0,
                combined_score=normalized_fts * fts_weight
            )
            
            combined_items[result.chunk_id] = combined_item
        
        # Process vector results and merge
        if vector_results and normalize_scores:
            max_vector_score = max((r.vector_score or 0) for r in vector_results)
            vector_normalizer = max_vector_score if max_vector_score > 0 else 1.0
        else:
            vector_normalizer = 1.0
        
        for result in vector_results:
            normalized_vector = (result.vector_score or 0) / vector_normalizer if normalize_scores else (result.vector_score or 0)
            
            if result.chunk_id in combined_items:
                # Update existing item
                item = combined_items[result.chunk_id]
                item.vector_score = normalized_vector
                item.distance = result.distance
                item.combined_score = (item.fts_score or 0) * fts_weight + normalized_vector * semantic_weight
            else:
                # Add new item from vector search only
                combined_item = SearchResultItem(
                    chunk_id=result.chunk_id,
                    doc_id=result.doc_id,
                    cik=result.cik,
                    company_name=result.company_name,
                    filename=result.filename,
                    section_name=result.section_name,
                    chunk_text=result.chunk_text,
                    char_count=result.char_count,
                    fts_score=0.0,
                    vector_score=normalized_vector,
                    distance=result.distance,
                    combined_score=normalized_vector * semantic_weight
                )
                
                combined_items[result.chunk_id] = combined_item
        
        # Sort by combined score (descending)
        sorted_results = sorted(
            combined_items.values(), 
            key=lambda x: x.combined_score or 0, 
            reverse=True
        )
        
        return sorted_results
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Get hybrid search capabilities and status."""
        fts_caps = self.fts_engine.get_capabilities()
        vector_caps = self.vector_engine.get_capabilities()
        
        return {
            "hybrid_available": self.hybrid_available,
            "fts_engine": fts_caps,
            "vector_engine": vector_caps,
            "features": [
                "Configurable FTS/Vector weighting",
                "Score normalization",
                "Intelligent result merging",
                "Graceful degradation to available methods",
                "Best of both keyword and semantic search"
            ],
            "default_weights": {
                "fts_weight": 0.3,
                "semantic_weight": 0.7
            }
        }
    
    def test_search(self, test_query: str = "revenue growth") -> Dict[str, Any]:
        """Test hybrid search functionality."""
        try:
            request = HybridSearchRequest(
                query=test_query, 
                limit=5,
                fts_weight=0.3,
                semantic_weight=0.7
            )
            response = self.search_chunks(request)
            
            # Calculate method distribution
            fts_count = sum(1 for r in response.results if (r.fts_score or 0) > 0)
            vector_count = sum(1 for r in response.results if (r.vector_score or 0) > 0)
            both_count = sum(1 for r in response.results if (r.fts_score or 0) > 0 and (r.vector_score or 0) > 0)
            
            return {
                "test_query": test_query,
                "method": "hybrid",
                "results_found": response.total_results,
                "search_time_ms": response.search_time_ms,
                "hybrid_working": self.hybrid_available,
                "method_distribution": {
                    "fts_only": fts_count - both_count,
                    "vector_only": vector_count - both_count,
                    "both_methods": both_count
                },
                "avg_combined_score": None if not response.results else
                    sum(r.combined_score or 0 for r in response.results) / len(response.results)
            }
        except Exception as e:
            return {
                "test_query": test_query,
                "error": str(e),
                "hybrid_working": False
            }
    
    def search_with_explanation(self, request: HybridSearchRequest) -> Dict[str, Any]:
        """
        Perform hybrid search with detailed explanation of the process.
        
        Args:
            request: Hybrid search request
            
        Returns:
            Dictionary with results and detailed explanation
        """
        response = self.search_chunks(request)
        
        # Add detailed explanation
        explanation = {
            "query_analysis": {
                "original_query": request.query,
                "search_method": "hybrid",
                "weight_distribution": {
                    "fts_weight": request.fts_weight,
                    "semantic_weight": request.semantic_weight,
                    "normalized": True if request.normalize_scores else False
                }
            },
            "search_process": {
                "step_1": "Performed FTS search for exact keyword matching",
                "step_2": "Performed vector search for semantic similarity",
                "step_3": "Combined results with weighted scoring",
                "step_4": f"Returned top {len(response.results)} results"
            },
            "result_composition": self._analyze_result_composition(response.results),
            "performance": {
                "total_time_ms": response.search_time_ms,
                "results_found": response.total_results
            }
        }
        
        return {
            "response": response.dict(),
            "explanation": explanation
        }
    
    def _analyze_result_composition(self, results: List[SearchResultItem]) -> Dict[str, Any]:
        """Analyze the composition of hybrid search results."""
        if not results:
            return {"total": 0}
        
        fts_only = sum(1 for r in results if (r.fts_score or 0) > 0 and (r.vector_score or 0) == 0)
        vector_only = sum(1 for r in results if (r.fts_score or 0) == 0 and (r.vector_score or 0) > 0)
        both_methods = sum(1 for r in results if (r.fts_score or 0) > 0 and (r.vector_score or 0) > 0)
        
        # Company distribution
        companies = {}
        for result in results:
            company = result.company_name or result.cik
            companies[company] = companies.get(company, 0) + 1
        
        return {
            "total_results": len(results),
            "source_breakdown": {
                "fts_only": fts_only,
                "vector_only": vector_only,
                "both_methods": both_methods
            },
            "company_distribution": dict(sorted(companies.items(), key=lambda x: x[1], reverse=True)),
            "score_ranges": {
                "combined_score_avg": sum(r.combined_score or 0 for r in results) / len(results),
                "combined_score_range": [
                    min(r.combined_score or 0 for r in results),
                    max(r.combined_score or 0 for r in results)
                ]
            }
        }
