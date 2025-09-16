import { useState } from "react"
import { Button } from "@/components/ui/button"
import { api, type CompanyTickerExchange, type DocumentMetadata, type SearchResult, type SearchResponse, type SearchCapabilities, type HealthResponse, type DatabaseStats } from "@/lib/api-client"

interface DemoState {
  loading: boolean;
  error: string | null;
  health?: HealthResponse;
  stats?: DatabaseStats;
  capabilities?: SearchCapabilities;
  companies: CompanyTickerExchange[];
  documents: DocumentMetadata[];
  searchResults: SearchResult[];
  // New search response data
  ftsResults?: SearchResponse;
  vectorResults?: SearchResponse;
  hybridResults?: SearchResponse;
  searchExplanation?: Record<string, unknown>;
}

export function SECApiDemo() {
  const [state, setState] = useState<DemoState>({
    loading: false,
    error: null,
    companies: [],
    documents: [],
    searchResults: []
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [tickerQuery, setTickerQuery] = useState("");
  
  // New search configuration state
  const [searchType, setSearchType] = useState<"fts" | "vector" | "hybrid">("hybrid");
  const [searchLimit, setSearchLimit] = useState(10);
  const [ftsWeight, setFtsWeight] = useState(0.3);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleAsync = async (operation: () => Promise<void>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await operation();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const checkHealth = async () => {
    await handleAsync(async () => {
      const health = await api.getHealth();
      setState(prev => ({ ...prev, health }));
    });
  };

  const getStats = async () => {
    await handleAsync(async () => {
      const stats = await api.getStats();
      setState(prev => ({ ...prev, stats }));
    });
  };

  const getSearchCapabilities = async () => {
    await handleAsync(async () => {
      const capabilities = await api.getSearchCapabilities();
      setState(prev => ({ ...prev, capabilities }));
    });
  };

  const searchCompanies = async () => {
    if (!companyQuery.trim()) return;
    
    await handleAsync(async () => {
      const companies = await api.getCompaniesByName(companyQuery.trim(), 10);
      setState(prev => ({ ...prev, companies }));
    });
  };

  const searchByTicker = async () => {
    if (!tickerQuery.trim()) return;
    
    await handleAsync(async () => {
      const companies = await api.getCompaniesByTicker(tickerQuery.trim(), 5);
      const documents = companies.length > 0 
        ? await api.getDocumentsByTicker(tickerQuery.trim(), 2019, 5)
        : [];
      setState(prev => ({ ...prev, companies, documents }));
    });
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    
    await handleAsync(async () => {
      const query = searchQuery.trim();
      
      if (searchType === "fts") {
        const ftsResults = await api.searchFTS({ query, limit: searchLimit });
        setState(prev => ({ ...prev, ftsResults, vectorResults: undefined, hybridResults: undefined, searchExplanation: undefined }));
      } else if (searchType === "vector") {
        const vectorResults = await api.searchVector({ query, limit: searchLimit });
        setState(prev => ({ ...prev, vectorResults, ftsResults: undefined, hybridResults: undefined, searchExplanation: undefined }));
      } else if (searchType === "hybrid") {
        if (showExplanation) {
          const explanation = await api.searchHybridWithExplanation({ 
            query, 
            limit: searchLimit, 
            fts_weight: ftsWeight,
            semantic_weight: 1 - ftsWeight 
          });
          setState(prev => ({ ...prev, searchExplanation: explanation, ftsResults: undefined, vectorResults: undefined, hybridResults: undefined }));
        } else {
          const hybridResults = await api.searchHybrid({ 
            query, 
            limit: searchLimit, 
            fts_weight: ftsWeight,
            semantic_weight: 1 - ftsWeight 
          });
          setState(prev => ({ ...prev, hybridResults, ftsResults: undefined, vectorResults: undefined, searchExplanation: undefined }));
        }
      }
    });
  };
  
  // Legacy method for backwards compatibility
  const searchFullText = async () => {
    if (!searchQuery.trim()) return;
    
    await handleAsync(async () => {
      const searchResults = await api.simpleSearch(searchQuery.trim(), 10);
      // Convert SearchResponse to legacy SearchResult format
      const legacyResults = searchResults.results.map(result => ({
        doc_id: result.doc_id,
        cik: result.cik,
        filename: result.filename,
        year: 2019, // Default year since new format doesn't have year
        company_name: result.company_name || "Unknown",
        section_name: result.section_name,
        content_snippet: result.chunk_text,
        char_count: result.char_count,
        search_score: result.combined_score || result.fts_score || result.vector_score
      }));
      setState(prev => ({ ...prev, searchResults: legacyResults }));
    });
  };

  const clearResults = () => {
    setState(prev => ({
      ...prev,
      companies: [],
      documents: [],
      searchResults: [],
      ftsResults: undefined,
      vectorResults: undefined,
      hybridResults: undefined,
      searchExplanation: undefined,
      health: undefined,
      stats: undefined,
      capabilities: undefined,
      error: null
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">SEC API Demo</h1>
        <p className="text-muted-foreground">
          Test the FastAPI server endpoints for SEC documents and company data
        </p>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <p className="text-destructive font-medium">Error:</p>
          <p className="text-sm text-destructive/80">{state.error}</p>
        </div>
      )}

      {/* Server Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Server Status</h2>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={checkHealth} disabled={state.loading} className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground shadow hover:bg-primary/90">
              Check Health
            </Button>
            <Button onClick={getStats} disabled={state.loading} className="h-8 rounded-md px-3 text-xs border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
              Get Stats
            </Button>
            <Button onClick={getSearchCapabilities} disabled={state.loading} className="h-8 rounded-md px-3 text-xs border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
              Search Info
            </Button>
          </div>
          
          {state.health && (
            <div className="bg-muted/50 rounded p-3 text-sm">
              <p><strong>Status:</strong> {state.health.status}</p>
              <p><strong>Message:</strong> {state.health.message}</p>
            </div>
          )}
          
          {state.stats && (
            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p><strong>Companies:</strong> {state.stats.company_tickers_exchange.toLocaleString()}</p>
              <p><strong>Documents:</strong> {state.stats.documents.toLocaleString()}</p>
              <p><strong>Sections:</strong> {state.stats.sections.toLocaleString()}</p>
              <p><strong>Chunks:</strong> {state.stats.chunks.toLocaleString()}</p>
              <p><strong>Embeddings:</strong> {state.stats.embeddings.toLocaleString()}</p>
            </div>
          )}
          
          {state.capabilities && (
            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p><strong>Search Capabilities:</strong></p>
              <div className="ml-2 space-y-1">
                <p>FTS: {state.capabilities.fts_available ? '✅' : '❌'}</p>
                <p>Vector: {state.capabilities.vector_available ? '✅' : '❌'}</p>
                <p>Hybrid: {state.capabilities.hybrid_available ? '✅' : '❌'}</p>
                {state.capabilities.embedding_model && (
                  <p><strong>Model:</strong> {state.capabilities.embedding_model}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Company Search */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Company Search</h2>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search companies by name..."
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              onKeyPress={(e) => e.key === 'Enter' && searchCompanies()}
            />
            <Button onClick={searchCompanies} disabled={state.loading} className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground shadow hover:bg-primary/90 w-full">
              Search Companies
            </Button>
          </div>
          
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search by ticker (e.g., AAPL)..."
              value={tickerQuery}
              onChange={(e) => setTickerQuery(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border rounded-md text-sm"
              onKeyPress={(e) => e.key === 'Enter' && searchByTicker()}
            />
            <Button onClick={searchByTicker} disabled={state.loading} className="h-8 rounded-md px-3 text-xs border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground w-full">
              Search by Ticker
            </Button>
          </div>
        </div>

        {/* Advanced Search */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Advanced Search</h2>
          
          {/* Search Input */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search document content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            />
          </div>
          
          {/* Search Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Method:</label>
            <select 
              value={searchType} 
              onChange={(e) => setSearchType(e.target.value as "fts" | "vector" | "hybrid")}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="hybrid">🔀 Hybrid (FTS + Vector)</option>
              <option value="fts">📝 Full-Text Search</option>
              <option value="vector">🧠 Semantic Search</option>
            </select>
          </div>
          
          {/* Search Configuration */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Results Limit:</label>
              <input
                type="number"
                value={searchLimit}
                onChange={(e) => setSearchLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-full px-2 py-1 border rounded text-sm"
                min="1" max="50"
              />
            </div>
            {searchType === "hybrid" && (
              <div>
                <label className="text-xs text-muted-foreground">FTS Weight:</label>
                <input
                  type="range"
                  value={ftsWeight}
                  onChange={(e) => setFtsWeight(parseFloat(e.target.value))}
                  className="w-full"
                  min="0" max="1" step="0.1"
                />
                <div className="text-xs text-center">{Math.round(ftsWeight * 100)}% / {Math.round((1-ftsWeight) * 100)}%</div>
              </div>
            )}
          </div>
          
          {/* Search Options */}
          {searchType === "hybrid" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showExplanation"
                checked={showExplanation}
                onChange={(e) => setShowExplanation(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="showExplanation" className="text-sm">Show detailed explanation</label>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-2">
            <Button onClick={performSearch} disabled={state.loading || !searchQuery.trim()} className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground shadow hover:bg-primary/90 w-full">
              🔍 {searchType === "fts" ? "FTS Search" : searchType === "vector" ? "Semantic Search" : "Hybrid Search"}
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={searchFullText} disabled={state.loading || !searchQuery.trim()} className="h-8 rounded-md px-3 text-xs border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
                Legacy Search
              </Button>
              <Button onClick={clearResults} disabled={state.loading} className="h-8 rounded-md px-3 text-xs bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90">
                Clear Results
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {state.loading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm">Loading...</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Companies Results */}
        {state.companies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Companies ({state.companies.length})</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {state.companies.map((company) => (
                <div key={`${company.cik}-${company.ticker}`} className="border rounded p-3 text-sm">
                  <div className="font-medium">{company.name}</div>
                  <div className="text-muted-foreground">
                    <span className="font-mono bg-muted px-1 rounded">{company.ticker}</span>
                    {' • '}
                    CIK: {company.cik}
                    {' • '}
                    {company.exchange}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents Results */}
        {state.documents.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Documents ({state.documents.length})</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {state.documents.map((doc) => (
                <div key={doc.doc_id} className="border rounded p-3 text-sm">
                  <div className="font-medium">{doc.filename}</div>
                  <div className="text-muted-foreground">
                    Year: {doc.year} • CIK: {doc.cik}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {doc.total_sections} sections • {doc.total_chars.toLocaleString()} chars
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Search Results */}
        {(state.ftsResults || state.vectorResults || state.hybridResults) && (
          <div className="lg:col-span-2 space-y-3">
            {state.ftsResults && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📝 FTS Results ({state.ftsResults.results.length})
                  <span className="text-sm text-muted-foreground">
                    {state.ftsResults.search_time_ms && `${state.ftsResults.search_time_ms.toFixed(1)}ms`}
                  </span>
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {state.ftsResults.results.map((result, index) => (
                    <div key={`fts-${result.chunk_id}-${index}`} className="border rounded p-4 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{result.company_name || "Unknown Company"}</div>
                        {result.fts_score && (
                          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            FTS: {result.fts_score.toFixed(3)}
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground mb-2">
                        <span className="font-medium">{result.section_name}</span>
                        {' • '}
                        {result.filename}
                      </div>
                      <div className="text-xs bg-muted/30 p-2 rounded italic">
                        "{result.chunk_text.substring(0, 300)}..."
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        CIK: {result.cik} • {result.char_count} chars
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {state.vectorResults && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🧠 Vector Results ({state.vectorResults.results.length})
                  <span className="text-sm text-muted-foreground">
                    {state.vectorResults.search_time_ms && `${state.vectorResults.search_time_ms.toFixed(1)}ms`}
                  </span>
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {state.vectorResults.results.map((result, index) => (
                    <div key={`vector-${result.chunk_id}-${index}`} className="border rounded p-4 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{result.company_name || "Unknown Company"}</div>
                        <div className="flex gap-1">
                          {result.distance && (
                            <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Dist: {result.distance.toFixed(3)}
                            </div>
                          )}
                          {result.vector_score && (
                            <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Vec: {result.vector_score.toFixed(3)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground mb-2">
                        <span className="font-medium">{result.section_name}</span>
                        {' • '}
                        {result.filename}
                      </div>
                      <div className="text-xs bg-muted/30 p-2 rounded italic">
                        "{result.chunk_text.substring(0, 300)}..."
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        CIK: {result.cik} • {result.char_count} chars
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {state.hybridResults && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🔀 Hybrid Results ({state.hybridResults.results.length})
                  <span className="text-sm text-muted-foreground">
                    {state.hybridResults.search_time_ms && `${state.hybridResults.search_time_ms.toFixed(1)}ms`}
                  </span>
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {state.hybridResults.results.map((result, index) => (
                    <div key={`hybrid-${result.chunk_id}-${index}`} className="border rounded p-4 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{result.company_name || "Unknown Company"}</div>
                        <div className="flex gap-1">
                          {result.fts_score && (
                            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              FTS: {result.fts_score.toFixed(3)}
                            </div>
                          )}
                          {result.vector_score && (
                            <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Vec: {result.vector_score.toFixed(3)}
                            </div>
                          )}
                          {result.combined_score && (
                            <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              Final: {result.combined_score.toFixed(3)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground mb-2">
                        <span className="font-medium">{result.section_name}</span>
                        {' • '}
                        {result.filename}
                      </div>
                      <div className="text-xs bg-muted/30 p-2 rounded italic">
                        "{result.chunk_text.substring(0, 300)}..."
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        CIK: {result.cik} • {result.char_count} chars
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Search Explanation */}
        {state.searchExplanation && (
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-lg font-semibold">🔍 Search Explanation</h3>
            <div className="bg-muted/50 rounded p-4 text-sm">
              <pre className="whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(state.searchExplanation, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Legacy Search Results */}
        {state.searchResults.length > 0 && (
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-lg font-semibold">Legacy Search Results ({state.searchResults.length})</h3>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {state.searchResults.map((result, index) => (
                <div key={`legacy-${result.doc_id}-${index}`} className="border rounded p-4 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">{result.company_name}</div>
                    {result.search_score && (
                      <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        Score: {result.search_score.toFixed(3)}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground mb-2">
                    <span className="font-medium">{result.section_name}</span>
                    {' • '}
                    {result.filename} ({result.year})
                  </div>
                  <div className="text-xs bg-muted/30 p-2 rounded italic">
                    "{result.content_snippet}"
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    CIK: {result.cik} • {result.char_count} chars
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* API Usage Examples */}
      <div className="border-t pt-6">
        <details className="group">
          <summary className="cursor-pointer font-medium mb-4 select-none">
            📝 API Usage Examples
            <span className="text-muted-foreground group-open:hidden"> (click to expand)</span>
          </summary>
          <div className="bg-muted/30 rounded p-4 text-sm font-mono space-y-3">
            <div>
              <div className="text-muted-foreground mb-1">// Import the API client</div>
              <div>import {'{ api }'} from '@/lib/api-client';</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// Search companies by name</div>
              <div>const companies = await api.getCompaniesByName('Apple', 10);</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// Get documents by ticker</div>
              <div>const docs = await api.getDocumentsByTicker('AAPL', 2019, 5);</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// FTS Search</div>
              <div>const fts = await api.searchFTS({'{ query: "revenue growth", limit: 10 }'});</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// Vector/Semantic Search</div>
              <div>const vector = await api.searchVector({'{ query: "financial performance", limit: 10 }'});</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// Hybrid Search</div>
              <div>const hybrid = await api.searchHybrid({'{ query: "revenue growth", fts_weight: 0.3, limit: 10 }'});</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">// Search capabilities</div>
              <div>const capabilities = await api.getSearchCapabilities();</div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
