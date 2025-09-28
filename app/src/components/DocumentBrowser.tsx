import { useState, useEffect } from "react"
import type { CompanyTickerExchange, DocumentMetadata } from "@/lib/api-client"
import { api } from "@/lib/api-client"

interface DocumentBrowserProps {
  company: CompanyTickerExchange | null
}

interface DocumentSection {
  section_id: string
  section_name: string
  content: string
  char_count: number
  chunk_count: number
}

// Keys for localStorage
const STORAGE_KEYS = {
  SELECTED_SECTION: 'sec-explorer-selected-section'
} as const

export function DocumentBrowser({ company }: DocumentBrowserProps) {
  const [document, setDocument] = useState<DocumentMetadata | null>(null)
  const [sections, setSections] = useState<DocumentSection[]>([])
  
  const [selectedSection, setSelectedSection] = useState<string | null>(() => {
    if (!company) return null
    try {
      const key = `${STORAGE_KEYS.SELECTED_SECTION}-${company.cik}`
      return localStorage.getItem(key) || null
    } catch (error) {
      console.warn('Failed to load selected section from localStorage', error)
      return null
    }
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noDocumentAvailable, setNoDocumentAvailable] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)

  // Save selected section to localStorage whenever it changes
  useEffect(() => {
    if (!company) return
    
    try {
      const key = `${STORAGE_KEYS.SELECTED_SECTION}-${company.cik}`
      if (selectedSection) {
        localStorage.setItem(key, selectedSection)
      } else {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn('Failed to save selected section to localStorage', error)
    }
  }, [selectedSection, company])

  useEffect(() => {
    if (company) {
      // Load persisted selected section for this company
      try {
        const key = `${STORAGE_KEYS.SELECTED_SECTION}-${company.cik}`
        const persistedSection = localStorage.getItem(key)
        setSelectedSection(persistedSection)
      } catch (error) {
        console.warn('Failed to load selected section from localStorage', error)
        setSelectedSection(null)
      }
      
      loadDocument(company.cik)
    } else {
      setDocument(null)
      setSections([])
      setSelectedSection(null)
      setError(null)
      setNoDocumentAvailable(false)
    }
  }, [company])

  const loadDocument = async (cik: number) => {
    setLoading(true)
    setError(null)
    setNoDocumentAvailable(false)
    
    try {
      // Use API client to get company's 2019 document
      const docs = await api.searchDocuments({ ciks: cik.toString(), year: 2019, limit: 1 })
      
      if (docs.length > 0) {
        setDocument(docs[0])
        
        // Load sections using the new API endpoint
        try {
          const sectionsData = await fetch(`http://localhost:8000/documents/${docs[0].doc_id}/sections`)
            .then(res => res.json())
          
          setSections(sectionsData.map((s: any) => ({ 
            section_id: s.section_id,
            section_name: s.section_name,
            content: '', // Content will be loaded on demand
            char_count: s.char_count || 0,
            chunk_count: s.chunk_count || 0
          })))
        } catch (sectionError) {
          console.warn('Could not load sections:', sectionError)
          setSections([]) // Fall back to empty sections
        }
      } else {
        setNoDocumentAvailable(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionSelect = async (sectionName: string) => {
    setSelectedSection(sectionName)
    
    // Load section content if document is available
    if (document) {
      const section = sections.find(s => s.section_name === sectionName)
      if (section && !section.content) {
        setLoadingContent(true)
        try {
          const response = await fetch(`http://localhost:8000/documents/${document.doc_id}/sections/${section.section_id}/content`)
            .then(res => res.json())
          
          // Update the section with content
          setSections(prev => prev.map(s => 
            s.section_name === sectionName 
              ? { ...s, content: response.content }
              : s
          ))
        } catch (error) {
          console.warn('Could not load section content:', error)
        } finally {
          setLoadingContent(false)
        }
      }
    }
  }

  if (!company) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <p>Select a company to view its documents</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (noDocumentAvailable) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {company.name} ({company.ticker})
          </h3>
          <p>Data for this company will be added soon. Currently, our dataset only includes 18 major public companies' 2019 10-K filings such as AMZN, AAPL, MSFT, GOOGL, TSLA, META, NVDA, ORCL.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button 
          onClick={() => company && loadDocument(company.cik)}
          className="text-blue-600 hover:text-blue-800"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Document Header */}
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          {company.name} ({company.ticker})
        </h3>
        {document && (
          <div className="text-sm text-gray-600 mt-2">
            <p>2019 10-K • {document.total_sections} sections • {document.total_chars.toLocaleString()} characters</p>
          </div>
        )}
      </div>

      {/* Sections and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Section List */}
        <div className="p-6 border-r">
          <h4 className="font-medium text-gray-900 mb-4">Document Sections</h4>
          {sections.length === 0 ? (
            <div className="text-sm text-gray-500">
              {document ? (
                <p>No sections found for this document.</p>
              ) : (
                <>
                  <p>Common 10-K sections include:</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• Business</li>
                    <li>• Risk Factors</li>
                    <li>• Management Discussion & Analysis</li>
                    <li>• Financial Statements</li>
                    <li>• Legal Proceedings</li>
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.section_id}
                  onClick={() => handleSectionSelect(section.section_name)}
                  className={`w-full text-left p-3 rounded-md text-sm transition-colors cursor-pointer ${
                    selectedSection === section.section_name
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{section.section_name}</div>
                  {section.chunk_count > 0 && (
                    <div className="text-xs text-gray-500">{section.chunk_count} chunks • {section.char_count.toLocaleString()} chars</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section Content */}
        <div className="p-6">
          <h4 className="font-medium text-gray-900 mb-4">Section Content</h4>
          {selectedSection ? (
            <div className="prose prose-sm max-w-none">
              {loadingContent ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              ) : (
                sections.find(s => s.section_name === selectedSection)?.content || (
                  <p className="text-gray-500">Select a section to load its content.</p>
                )
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              <p>Select a section to view its content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
