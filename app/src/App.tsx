import { useState, useEffect } from "react"
import { CompanyTable } from "@/components/CompanyTable"
import { DocumentBrowser } from "@/components/DocumentBrowser"
import { SearchInterface } from "@/components/SearchInterface"
import type { CompanyTickerExchange, SearchResultItem } from "@/lib/api-client"

// Keys for localStorage
const STORAGE_KEYS = {
  SELECTED_COMPANY: 'sec-explorer-selected-company'
} as const

function App() {
  const [selectedCompany, setSelectedCompany] = useState<CompanyTickerExchange | null>(() => {
    try {
      const savedCompany = localStorage.getItem(STORAGE_KEYS.SELECTED_COMPANY)
      return savedCompany ? JSON.parse(savedCompany) : null
    } catch (error) {
      console.warn('Failed to load selected company from localStorage', error)
      return null
    }
  })

  // Save selected company to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedCompany) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, JSON.stringify(selectedCompany))
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_COMPANY)
      }
    } catch (error) {
      console.warn('Failed to save selected company to localStorage', error)
    }
  }, [selectedCompany])

  const handleViewDocument = (company: CompanyTickerExchange) => {
    setSelectedCompany(company)
  }

  const handleNavigateToSection = (result: SearchResultItem) => {
    // Find company and navigate to section
    // This could trigger section highlighting in DocumentBrowser
    console.log('Navigate to section:', result)
  }

         return (
           <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
             <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200">
               <div className="max-w-7xl mx-auto px-6 py-6">
                 <div className="flex items-center space-x-3">
                   <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                     <span className="text-white font-bold text-lg">S</span>
                   </div>
                   <div>
                     <h1 className="text-3xl font-bold text-gray-900">SEC 10-K Explorer</h1>
                     <p className="text-gray-600 mt-1">Search and analyze SEC filings with advanced AI-powered search</p>
                   </div>
                 </div>
               </div>
             </header>

             <div className="w-full px-4 py-4">
               {/* Company Table and Document Browser - Side by Side */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                 {/* Left: Company List */}
                 <div className="min-w-0">
                   <h2 className="text-xl font-bold text-gray-900 mb-4">Companies</h2>
                   <CompanyTable onViewDocument={handleViewDocument} />
                 </div>

                 {/* Right: Document Browser */}
                 <div className="min-w-0">
                   <h2 className="text-xl font-bold text-gray-900 mb-4">Document Browser</h2>
                   <DocumentBrowser company={selectedCompany} />
                 </div>
               </div>

               {/* Search Interface - Full Width */}
               <div>
                 <h2 className="text-xl font-bold text-gray-900 mb-4">Advanced Search</h2>
                 <SearchInterface onNavigateToSection={handleNavigateToSection} />
               </div>
             </div>
           </div>
         )
}

export default App