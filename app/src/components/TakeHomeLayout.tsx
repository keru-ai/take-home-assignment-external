import { useCallback, useEffect, useState } from "react"

import { api, type CompanyTickerExchange } from "@/lib/api-client"

const COMPANY_FETCH_LIMIT = 1000
const COMPANY_SEARCH_LIMIT = 200

const sortCompanies = (list: CompanyTickerExchange[]): CompanyTickerExchange[] => {
  return [...list].sort((a, b) => {
    const nameA = a.name?.toLowerCase() ?? ""
    const nameB = b.name?.toLowerCase() ?? ""
    return nameA.localeCompare(nameB)
  })
}

export function TakeHomeLayout() {
  const [companySearch, setCompanySearch] = useState("")
  const [companies, setCompanies] = useState<CompanyTickerExchange[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<Record<number, CompanyTickerExchange>>({})
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<CompanyTickerExchange[] | undefined>(undefined)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true)
      setCompaniesError(null)

      // Use a wildcard match to return a broad set of companies.
      const result = await api.searchCompanies({ name: "%", limit: COMPANY_FETCH_LIMIT })
      setCompanies(sortCompanies(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load companies"
      setCompaniesError(message)
      console.error("[TakeHome] Failed to load companies", error)
    } finally {
      setCompaniesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    const term = companySearch.trim()

    if (term === "") {
      setSearchResults(undefined)
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    setSearchError(null)

    const timer = window.setTimeout(async () => {
      try {
        const namePattern = term
        const requests = [
          api.searchCompanies({ name: namePattern, limit: COMPANY_SEARCH_LIMIT })
        ]

        if (/^[A-Za-z0-9.-]{1,6}$/.test(term)) {
          requests.push(
            api.searchCompanies({ ticker: term.toUpperCase(), limit: COMPANY_SEARCH_LIMIT })
          )
        }

        const responses = await Promise.all(requests)

        if (!cancelled) {
          const merged = new Map<number, CompanyTickerExchange>()
          responses.flat().forEach((company) => {
            merged.set(company.cik, company)
          })

          setSearchResults(sortCompanies(Array.from(merged.values())))
          setSearchLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Search failed"
          setSearchError(message)
          setSearchResults([])
          setSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [companySearch])

  const selectedCount = Object.keys(selectedCompanies).length

  const clearSelectedCompanies = useCallback(() => {
    setSelectedCompanies({})
    console.log("[TakeHome] Selected companies cleared")
  }, [])

  const handleCompanyToggle = useCallback((company: CompanyTickerExchange) => {
    setSelectedCompanies((prev) => {
      const next = { ...prev }
      if (next[company.cik]) {
        delete next[company.cik]
      } else {
        next[company.cik] = company
      }

      const tickerSummary = Object.values(next)
        .map((item) => item.ticker)
        .join(", ") || "none"
      console.log(`[TakeHome] Selected companies: ${tickerSummary}`)

      return next
    })
  }, [])

  const renderCompanyList = () => {
    const termActive = companySearch.trim() !== ""
    const loading = termActive ? searchLoading : companiesLoading
    const error = termActive ? searchError : companiesError
    const dataset = termActive ? searchResults ?? [] : companies

    if (loading) {
      return (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
          Loading companies…
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )
    }

    if (termActive && dataset.length === 0) {
      return (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
          No companies found
        </div>
      )
    }

    if (!termActive && dataset.length === 0) {
      return (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
          No companies loaded yet
        </div>
      )
    }

    return (
      <ul className="space-y-2 text-sm text-slate-700">
        {dataset.map((company) => {
          const isSelected = Boolean(selectedCompanies[company.cik])
          return (
            <li key={`${company.cik}-${company.ticker}`}>
              <button
                type="button"
                onClick={() => handleCompanyToggle(company)}
                className={`w-full rounded-md border px-3 py-2 text-left transition flex flex-col ${
                  isSelected
                    ? "border-transparent bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-100"
                }`}
              >
                <span className={`block truncate text-sm font-medium ${
                  isSelected ? "text-white" : "text-slate-700"
                }`}>
                  {company.name}
                </span>
                <span className={`mt-1 block text-xs uppercase tracking-wide ${
                  isSelected ? "text-slate-200" : "text-slate-500"
                }`}>
                  {company.ticker}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="h-screen min-h-screen overflow-hidden grid grid-cols-[260px_minmax(0,1fr)] grid-rows-[auto_auto_1fr] bg-slate-50 text-slate-900">
      <header className="col-span-2 border-b border-slate-200 bg-white px-6 py-4 flex items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center">
            <img
              src="/SEC_demo_logo.avif"
              alt="SEC Demo"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">SEC Demo</h1>
            <p className="text-sm text-slate-500">Search and explore 10-K filings</p>
          </div>
        </div>
      </header>

      <div className="border-r border-slate-200 bg-white px-6 py-3 flex items-center">
        <h2 className="text-2xl font-semibold whitespace-nowrap">Companies</h2>
      </div>

      <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center">
        <div className="w-full max-w-xl">
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-slate-500">
            Search bar here
          </div>
        </div>
      </div>

      <div className="border-r border-slate-200 bg-white px-6 py-3 flex flex-col gap-2.5 overflow-hidden">
        <input
          type="search"
          value={companySearch}
          onChange={(event) => setCompanySearch(event.target.value)}
          placeholder="Search companies…"
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
        />
        {selectedCount > 0 ? (
          <div className="flex items-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow-sm">
              Selected: {selectedCount}
              <button
                type="button"
                onClick={clearSelectedCompanies}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] leading-none hover:bg-slate-600"
                aria-label="Clear selected companies"
              >
                ×
              </button>
            </span>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto pr-1">
          {renderCompanyList()}
        </div>
      </div>

      <div className="bg-slate-50 px-6 py-6 overflow-y-auto">
        <div className="min-h-[200px] rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-slate-500 shadow-sm">
          Results here
        </div>
      </div>
    </div>
  )
}
