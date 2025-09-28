import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { api, type SearchResultItem, type SearchResponse } from "@/lib/api-client"

interface SearchInterfaceProps {
  onNavigateToSection: (result: SearchResultItem) => void
}

// Keys for localStorage
const STORAGE_KEYS = {
  SEARCH_QUERY: 'sec-explorer-search-query',
  SEARCH_TYPE: 'sec-explorer-search-type'
} as const

export function SearchInterface({ onNavigateToSection }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SEARCH_QUERY) || ""
    } catch (error) {
      console.warn('Failed to load search query from localStorage', error)
      return ""
    }
  })
  
  const [searchType, setSearchType] = useState<'fts' | 'vector' | 'hybrid'>(() => {
    try {
      const savedType = localStorage.getItem(STORAGE_KEYS.SEARCH_TYPE) as 'fts' | 'vector' | 'hybrid' | null
      return (savedType && ['fts', 'vector', 'hybrid'].includes(savedType)) ? savedType : 'vector'
    } catch (error) {
      console.warn('Failed to load search type from localStorage', error)
      return 'vector'
    }
  })
  
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [totalResults, setTotalResults] = useState<number>(0)
  const [hasSearched, setHasSearched] = useState(false)

  // Save search query to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_QUERY, searchQuery)
    } catch (error) {
      console.warn('Failed to save search query to localStorage', error)
    }
  }, [searchQuery])

  // Save search type to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_TYPE, searchType)
    } catch (error) {
      console.warn('Failed to save search type to localStorage', error)
    }
  }, [searchType])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)
    setResults([])
    setSearchTime(null)
    setTotalResults(0)
    setHasSearched(true)

    try {
      let response: SearchResponse

      switch (searchType) {
        case 'fts':
          response = await api.searchFTS({
            query: searchQuery,
            limit: 20
          })
          break
        case 'vector':
          response = await api.searchVector({
            query: searchQuery,
            limit: 20,
            include_distances: true
          })
          break
        case 'hybrid':
          response = await api.searchHybrid({
            query: searchQuery,
            limit: 20,
            fts_weight: 0.3,
            semantic_weight: 0.7,
            normalize_scores: true
          })
          break
        default:
          throw new Error('Invalid search type')
      }

      setResults(response.results)
      setSearchTime(response.search_time_ms || null)
      setTotalResults(response.total_results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSearchTypeChange = (newSearchType: 'fts' | 'vector' | 'hybrid') => {
    setSearchType(newSearchType)
    // Clear previous results when changing search type
    setResults([])
    setError(null)
    setSearchTime(null)
    setTotalResults(0)
    setHasSearched(false)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Search Controls */}
      <div className="p-6 border-b">
        <div className="flex flex-col space-y-4">
          {/* Search Input */}
          <div className="flex space-x-4">
            <input
              type="text"
              placeholder="Search across all documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Type Selection */}
          <div className="flex items-center space-x-4">
            <label htmlFor="searchType" className="text-sm font-medium text-gray-700">
              Search Type:
            </label>
            <select
              id="searchType"
              value={searchType}
              onChange={(e) => handleSearchTypeChange(e.target.value as 'fts' | 'vector' | 'hybrid')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
                     <option value="fts">Full-Text Search (FTS)</option>
                     <option value="vector">Vector Search (Semantic)</option>
                     <option value="hybrid">Hybrid Search (FTS + Vector)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="p-6">
        {error && (
          <div className="text-red-600 mb-4">Error: {error}</div>
        )}

        {results.length === 0 && !loading && hasSearched && searchQuery && (
          <div className="text-center text-gray-500 py-8">
            <p>No results found for "{searchQuery}"</p>
            <p className="text-sm mt-2">Try different search terms or search types</p>
          </div>
        )}

        {!hasSearched && (
          <div className="text-center text-gray-500 py-8">
            <p>Enter a search query to find relevant sections across all documents</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Searching...</span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Found {totalResults} results using {searchType} search
              </span>
              {searchTime && (
                <span className="text-xs text-gray-500">
                  Search completed in {searchTime}ms
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={result.chunk_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-blue-600">
                          {result.company_name || 'Unknown Company'}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-600">
                          {result.section_name}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">
                          {result.filename}
                        </span>
                      </div>
                      
                      {/* Search Scores */}
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                        {result.fts_score && (
                          <span>FTS: {result.fts_score.toFixed(3)}</span>
                        )}
                        {result.vector_score && (
                          <span>Vector: {result.vector_score.toFixed(3)}</span>
                        )}
                        {result.combined_score && (
                          <span>Combined: {result.combined_score.toFixed(3)}</span>
                        )}
                        {result.distance && (
                          <span>Distance: {result.distance.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigateToSection(result)}
                      className="text-xs"
                    >
                      View Section
                    </Button>
                  </div>
                  
                  {/* Content Excerpt */}
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <p className="line-clamp-4">
                      {result.chunk_text.length > 500 
                        ? `${result.chunk_text.substring(0, 500)}...` 
                        : result.chunk_text
                      }
                    </p>
                    {result.chunk_text.length > 500 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {result.char_count.toLocaleString()} characters total
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}