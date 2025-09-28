import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/Pagination"
import { api, type CompanyTickerExchange } from "@/lib/api-client"
import * as Table from "@radix-ui/themes/components/table"

interface CompanyTableProps {
  onViewDocument: (company: CompanyTickerExchange) => void
}

export function CompanyTable({ onViewDocument }: CompanyTableProps) {
  const [companies, setCompanies] = useState<CompanyTickerExchange[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyTickerExchange[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load all companies on component mount
  useEffect(() => {
    loadCompanies()
  }, [])

  // Filter companies when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCompanies(companies)
    } else {
      const filtered = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.ticker.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredCompanies(filtered)
    }
    setCurrentPage(1) // Reset to first page when filtering
  }, [searchTerm, companies])

  const loadCompanies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get ALL companies - no search parameters means return everything
      const allCompanies = await api.searchCompanies({ limit: 20000 })
      setCompanies(allCompanies)
      setFilteredCompanies(allCompanies)
    } catch (err) {
      console.error('Error loading companies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const handleViewDocument = (company: CompanyTickerExchange) => {
    onViewDocument(company)
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredCompanies.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentCompanies = filteredCompanies.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Button onClick={loadCompanies} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b bg-gray-50">
        <div className="relative">
          <input
            type="text"
            placeholder="Search companies by name or ticker..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

               {/* Styled Table */}
               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Company Name
                       </th>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                         Ticker
                       </th>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                         CIK
                       </th>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                         Exchange
                       </th>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                         Action
                       </th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {currentCompanies.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                           {searchTerm ? 'No companies found matching your search.' : 'No companies available.'}
                         </td>
                       </tr>
                     ) : (
                       currentCompanies.map((company) => (
                         <tr key={`${company.cik}-${company.ticker}`} className="hover:bg-gray-50 transition-colors">
                           <td className="px-3 py-2">
                             <div 
                               className="text-sm font-medium text-gray-900 truncate cursor-help" 
                               title={company.name}
                             >
                               {company.name}
                             </div>
                           </td>
                           <td className="px-3 py-2">
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                               {company.ticker}
                             </span>
                           </td>
                           <td className="px-3 py-2 text-sm text-gray-500">
                             {company.cik}
                           </td>
                           <td className="px-3 py-2 text-sm text-gray-500">
                             {company.exchange || 'Unknown'}
                           </td>
                           <td className="px-3 py-2">
                             <button
                               onClick={() => handleViewDocument(company)}
                               className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
                             >
                               View SEC Doc
                             </button>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>

      {/* Pagination Controls */}
      {filteredCompanies.length > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCompanies.length}
          itemsPerPage={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
