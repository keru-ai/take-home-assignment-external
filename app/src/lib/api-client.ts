/**
 * API Client for SEC Documents and Metadata Server
 * 
 * TypeScript client for interacting with the FastAPI server that provides
 * access to SEC filing documents and company metadata.
 */

// API Response Types
export interface HealthResponse {
  status: string;
  message: string;
}

export interface HelloResponse {
  message: string;
  status: string;
}

export interface CompanyTickerExchange {
  cik: number;
  name: string;
  ticker: string;
  exchange?: string | null;
}

export interface CompanyTicker {
  index_key: number;
  cik: number;
  ticker: string;
  title: string;
}

export interface DocumentMetadata {
  doc_id: string;
  cik: string;
  filename: string;
  year: number;
  file_path: string;
  total_sections: number;
  total_chars: number;
  ingested_at: string;
  processor_version: string;
}

export interface DocumentSection {
  section_id: string;
  section_name: string;
  content: string;
}

export interface DatabaseStats {
  company_tickers_exchange: number;
  company_tickers: number;
  documents: number;
  sections: number;
  chunks: number;
  embeddings: number;
}

// Search Response Types  
export interface SearchResultItem {
  chunk_id: string;
  doc_id: string;
  cik: string;
  company_name?: string;
  filename: string;
  section_name: string;
  chunk_text: string;
  char_count: number;
  
  // Search-specific scores
  fts_score?: number;
  vector_score?: number;
  distance?: number;
  combined_score?: number;
}

export interface SearchResponse {
  query: string;
  method: string;
  total_results: number;
  results: SearchResultItem[];
  
  // Search metadata
  search_time_ms?: number;
  explanation?: Record<string, unknown>;
}

export interface SearchCapabilities {
  fts_available: boolean;
  vector_available: boolean;
  hybrid_available: boolean;
  
  // Extension status
  fts_extension_loaded: boolean;
  vss_extension_loaded: boolean;
  
  // Database statistics
  total_chunks: number;
  total_embeddings: number;
  
  // Configuration
  embedding_model?: string;
  vector_dimensions?: number;
}

// Legacy type for backwards compatibility
export interface SearchResult {
  doc_id: string;
  cik: string;
  filename: string;
  year: number;
  company_name: string;
  section_name: string;
  content_snippet: string;
  char_count: number;
  search_score?: number;
}

export interface ServerInfo {
  server: string;
  version: string;
  python: string;
  status: string;
  database: string;
  endpoints: Record<string, string>;
}

// Search Parameters
export interface CompanySearchParams {
  name?: string;
  ticker?: string;
  cik?: number;
  exchange?: string;
  has_documents_only?: boolean;
  limit?: number;
}

export interface DocumentSearchParams {
  tickers?: string;
  ciks?: string;
  year?: number;
  limit?: number;
}

// Search Request Types
export interface SearchRequest {
  query: string;
  limit?: number;
  tickers?: string[];
  ciks?: string[];
}

export interface FTSSearchRequest extends SearchRequest {
  min_score?: number;
}

export interface VectorSearchRequest extends SearchRequest {
  include_distances?: boolean;
  max_distance?: number;
}

export interface HybridSearchRequest extends SearchRequest {
  fts_weight?: number;
  semantic_weight?: number;
  normalize_scores?: boolean;
}

export interface FullTextSearchParams {
  query: string;
  limit?: number;
  min_score?: number;
}

// API Error Type
export interface APIError {
  detail: string;
  status_code?: number;
}

/**
 * Main API Client Class
 */
export class SECApiClient {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Helper to build query string from parameters
   */
  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value.toString());
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // Basic Endpoints

  /**
   * Get root welcome message
   */
  async getRoot(): Promise<HelloResponse> {
    return this.fetchAPI<HelloResponse>('/');
  }

  /**
   * Check server health and database connectivity
   */
  async getHealth(): Promise<HealthResponse> {
    return this.fetchAPI<HealthResponse>('/health');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    return this.fetchAPI<DatabaseStats>('/stats');
  }

  /**
   * Get server information
   */
  async getInfo(): Promise<ServerInfo> {
    return this.fetchAPI<ServerInfo>('/info');
  }

  // Company Search

  /**
   * Search companies by name, ticker, CIK, or exchange
   */
  async searchCompanies(params: CompanySearchParams): Promise<CompanyTickerExchange[]> {
    const queryString = this.buildQueryString(params as Record<string, unknown>);
    return this.fetchAPI<CompanyTickerExchange[]>(`/companies/search${queryString}`);
  }

  // Document Search

  /**
   * Search documents by ticker symbols, CIKs, and/or year
   */
  async searchDocuments(params: DocumentSearchParams): Promise<DocumentMetadata[]> {
    const queryString = this.buildQueryString(params as Record<string, unknown>);
    return this.fetchAPI<DocumentMetadata[]>(`/documents/search${queryString}`);
  }

  /**
   * Get document metadata by document ID
   */
  async getDocumentById(docId: string): Promise<DocumentMetadata> {
    return this.fetchAPI<DocumentMetadata>(`/documents/${encodeURIComponent(docId)}`);
  }

  /**
   * Get ordered sections for a document
   */
  async getDocumentSections(docId: string): Promise<DocumentSection[]> {
    return this.fetchAPI<DocumentSection[]>(`/documents/${encodeURIComponent(docId)}/sections`);
  }

  // New Advanced Search Methods

  /**
   * Get search capabilities and status
   */
  async getSearchCapabilities(): Promise<SearchCapabilities> {
    return this.fetchAPI<SearchCapabilities>('/search/capabilities');
  }

  /**
   * Full-text search using DuckDB FTS with BM25 ranking
   */
  async searchFTS(request: FTSSearchRequest): Promise<SearchResponse> {
    return this.fetchAPI<SearchResponse>('/search/fts', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Vector similarity search using OpenAI embeddings
   */
  async searchVector(request: VectorSearchRequest): Promise<SearchResponse> {
    return this.fetchAPI<SearchResponse>('/search/vector', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Hybrid search combining FTS and Vector search
   */
  async searchHybrid(request: HybridSearchRequest): Promise<SearchResponse> {
    return this.fetchAPI<SearchResponse>('/search/hybrid', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Hybrid search with detailed explanation of search process
   */
  async searchHybridWithExplanation(request: HybridSearchRequest): Promise<Record<string, unknown>> {
    return this.fetchAPI<Record<string, unknown>>('/search/hybrid/explain', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Legacy Full-Text Search (for backwards compatibility)

  /**
   * Search through document content using full-text search
   */
  async searchFullText(params: FullTextSearchParams): Promise<SearchResult[]> {
    const queryString = this.buildQueryString(params as unknown as Record<string, unknown>);
    return this.fetchAPI<SearchResult[]>(`/search/fulltext${queryString}`);
  }

  // Convenience Methods

  /**
   * Search companies by ticker symbol
   */
  async getCompaniesByTicker(ticker: string, limit: number = 50): Promise<CompanyTickerExchange[]> {
    return this.searchCompanies({ ticker, limit });
  }

  /**
   * Search companies by name
   */
  async getCompaniesByName(name: string, limit: number = 50): Promise<CompanyTickerExchange[]> {
    return this.searchCompanies({ name, limit });
  }

  /**
   * Get company by CIK
   */
  async getCompanyByCik(cik: number): Promise<CompanyTickerExchange[]> {
    return this.searchCompanies({ cik, limit: 1 });
  }

  /**
   * Get documents for a company by ticker
   */
  async getDocumentsByTicker(ticker: string, year?: number, limit: number = 50): Promise<DocumentMetadata[]> {
    return this.searchDocuments({ tickers: ticker, year, limit });
  }

  /**
   * Get documents for a company by CIK
   */
  async getDocumentsByCik(cik: string, year?: number, limit: number = 50): Promise<DocumentMetadata[]> {
    return this.searchDocuments({ ciks: cik, year, limit });
  }

  /**
   * Simple text search with default parameters (uses new FTS endpoint)
   */
  async simpleSearch(query: string, limit: number = 20): Promise<SearchResponse> {
    return this.searchFTS({ query, limit });
  }

  /**
   * Simple semantic search with default parameters
   */
  async simpleSemanticSearch(query: string, limit: number = 20): Promise<SearchResponse> {
    return this.searchVector({ query, limit });
  }

  /**
   * Simple hybrid search with default parameters
   */
  async simpleHybridSearch(query: string, limit: number = 20): Promise<SearchResponse> {
    return this.searchHybrid({ query, limit });
  }
}

// Create default client instance
export const apiClient = new SECApiClient();

// Export convenience functions that use the default client
export const api = {
  // Basic
  getHealth: () => apiClient.getHealth(),
  getStats: () => apiClient.getStats(),
  getInfo: () => apiClient.getInfo(),
  
  // Companies
  searchCompanies: (params: CompanySearchParams) => apiClient.searchCompanies(params),
  getCompaniesByTicker: (ticker: string, limit?: number) => apiClient.getCompaniesByTicker(ticker, limit),
  getCompaniesByName: (name: string, limit?: number) => apiClient.getCompaniesByName(name, limit),
  getCompanyByCik: (cik: number) => apiClient.getCompanyByCik(cik),
  
  // Documents
  searchDocuments: (params: DocumentSearchParams) => apiClient.searchDocuments(params),
  getDocumentById: (docId: string) => apiClient.getDocumentById(docId),
  getDocumentSections: (docId: string) => apiClient.getDocumentSections(docId),
  getDocumentsByTicker: (ticker: string, year?: number, limit?: number) => apiClient.getDocumentsByTicker(ticker, year, limit),
  getDocumentsByCik: (cik: string, year?: number, limit?: number) => apiClient.getDocumentsByCik(cik, year, limit),
  
  // Search
  getSearchCapabilities: () => apiClient.getSearchCapabilities(),
  searchFTS: (request: FTSSearchRequest) => apiClient.searchFTS(request),
  searchVector: (request: VectorSearchRequest) => apiClient.searchVector(request),
  searchHybrid: (request: HybridSearchRequest) => apiClient.searchHybrid(request),
  searchHybridWithExplanation: (request: HybridSearchRequest) => apiClient.searchHybridWithExplanation(request),
  searchFullText: (params: FullTextSearchParams) => apiClient.searchFullText(params),
  simpleSearch: (query: string, limit?: number) => apiClient.simpleSearch(query, limit),
  simpleSemanticSearch: (query: string, limit?: number) => apiClient.simpleSemanticSearch(query, limit),
  simpleHybridSearch: (query: string, limit?: number) => apiClient.simpleHybridSearch(query, limit),
};

export default apiClient;
