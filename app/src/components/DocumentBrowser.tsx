import { useState, useEffect } from "react"
import type { CompanyTickerExchange, DocumentMetadata } from "@/lib/api-client"

interface DocumentBrowserProps {
  company: CompanyTickerExchange | null
}

interface DocumentSection {
  section_name: string
  content: string
}

export function DocumentBrowser({ company }: DocumentBrowserProps) {
  const [document, setDocument] = useState<DocumentMetadata | null>(null)
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (company) {
      loadDocument(company.cik)
    } else {
      setDocument(null)
      setSections([])
      setSelectedSection(null)
    }
  }, [company])

  const loadDocument = async (cik: number) => {
    setLoading(true)
    setError(null)
    
    try {
      // Get company's 2019 document using the API client
      const docs = await fetch(`http://localhost:8000/documents/search?ciks=${cik}&year=2019&limit=1`)
        .then(res => res.json())
      
      if (docs.length > 0) {
        setDocument(docs[0])
        // TODO: Load sections when API endpoint is available
        // const sectionsData = await fetch(`http://localhost:8000/documents/${docs[0].doc_id}/sections`)
        //   .then(res => res.json())
        // setSections(sectionsData)
        setSections([]) // Placeholder until API is ready
      } else {
        setError('No 2019 document found for this company')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionSelect = (sectionName: string) => {
    setSelectedSection(sectionName)
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
              <p>Sections will be available once the API endpoint is implemented.</p>
              <p className="mt-2">Common 10-K sections include:</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Business</li>
                <li>• Risk Factors</li>
                <li>• Management Discussion & Analysis</li>
                <li>• Financial Statements</li>
                <li>• Legal Proceedings</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.section_name}
                  onClick={() => handleSectionSelect(section.section_name)}
                  className={`w-full text-left p-3 rounded-md text-sm transition-colors ${
                    selectedSection === section.section_name
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {section.section_name}
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
              {sections.find(s => s.section_name === selectedSection)?.content || (
                <p className="text-gray-500">Content will be displayed here once sections are loaded.</p>
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