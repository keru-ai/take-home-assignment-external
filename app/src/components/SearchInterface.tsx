import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { SearchResultItem } from "@/lib/api-client"

interface SearchInterfaceProps {
  onNavigateToSection: (result: SearchResultItem) => void
}

export function SearchInterface({ onNavigateToSection }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<'fts' | 'vector' | 'hybrid'>('vector')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)

    try {
      // TODO: Implement actual search API calls
      // This is a placeholder until we implement the search functionality
      console.log('Search:', { query: searchQuery, type: searchType })
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Placeholder results
      setResults([])
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Type Selection */}
          <div className="flex space-x-2">
            <Button
              variant={searchType === 'fts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchType('fts')}
            >
              📝 FTS
            </Button>
            <Button
              variant={searchType === 'vector' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchType('vector')}
            >
              🧠 Vector
            </Button>
            <Button
              variant={searchType === 'hybrid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchType('hybrid')}
            >
              🔀 Hybrid
            </Button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="p-6">
        {error && (
          <div className="text-red-600 mb-4">Error: {error}</div>
        )}

        {results.length === 0 && !loading && searchQuery && (
          <div className="text-center text-gray-500 py-8">
            <p>No results found for "{searchQuery}"</p>
            <p className="text-sm mt-2">Try different search terms or search types</p>
          </div>
        )}

        {!searchQuery && (
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

        {/* Results will be displayed here once implemented */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Found {results.length} results using {searchType} search
            </div>
            {/* Results list will go here */}
          </div>
        )}
      </div>
    </div>
  )
}