import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  api,
  type CompanyTickerExchange,
  type DocumentMetadata,
  type DocumentSection,
  type SearchResponse,
  type SearchResultItem,
} from "@/lib/api-client"
import { DocumentCard } from "./ui/DocumentCard"
import { SearchResultCard } from "./ui/SearchResultCard"
import { TenKDocumentDrawer } from "./ui/TenKDocumentDrawer"

const COMPANY_FETCH_LIMIT = 1000
const COMPANY_SEARCH_LIMIT = 200
const SEARCH_RESULTS_LIMIT = 20
const DOCUMENT_RESULTS_LIMIT = 200
const SNIPPET_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 4,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
}
const SEARCH_MODE_OPTIONS = [
  { id: "fts", label: "Full-text" },
  { id: "vector", label: "Vector" },
  { id: "hybrid", label: "Hybrid" },
] as const

const SECTION_DISPLAY_MAP: Record<string, string> = {
  section_1: "Item 1. Business",
  section_1a: "Item 1A. Risk Factors",
  section_1b: "Item 1B. Unresolved Staff Comments",
  section_2: "Item 2. Properties",
  section_3: "Item 3. Legal Proceedings",
  section_4: "Item 4. Mine Safety Disclosures",
  section_5:
    "Item 5. Market for Registrant’s Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
  section_6: "Item 6. Selected Financial Data",
  section_7:
    "Item 7. Management’s Discussion and Analysis of Financial Condition and Results of Operations",
  section_7a:
    "Item 7A. Quantitative and Qualitative Disclosures About Market Risk",
  section_8: "Item 8. Financial Statements and Supplementary Data",
  section_9:
    "Item 9. Changes in and Disagreements with Accountants on Accounting and Financial Disclosure",
  section_9a: "Item 9A. Controls and Procedures",
  section_9b: "Item 9B. Other Information",
  section_10: "Item 10. Directors, Executive Officers and Corporate Governance",
  section_11: "Item 11. Executive Compensation",
  section_12:
    "Item 12. Security Ownership of Certain Beneficial Owners and Management and Related Stockholder Matters",
  section_13:
    "Item 13. Certain Relationships and Related Transactions, and Director Independence",
  section_14: "Item 14. Principal Accountant Fees and Services",
  section_15: "Item 15. Exhibits and Financial Statement Schedules",
}

const sortCompanies = (list: CompanyTickerExchange[]): CompanyTickerExchange[] => {
  return [...list].sort((a, b) => {
    const nameA = a.name?.toLowerCase() ?? ""
    const nameB = b.name?.toLowerCase() ?? ""
    return nameA.localeCompare(nameB)
  })
}

export function TenKFileExplorer() {
  const [companySearch, setCompanySearch] = useState("")
  const [companies, setCompanies] = useState<CompanyTickerExchange[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<Record<number, CompanyTickerExchange>>({})
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<CompanyTickerExchange[] | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [searchMode, setSearchMode] = useState<"fts" | "vector" | "hybrid">("hybrid")
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [documentResults, setDocumentResults] = useState<DocumentMetadata[]>([])
  const [documentCache, setDocumentCache] = useState<Record<string, DocumentMetadata>>({})
  const documentCacheRef = useRef(documentCache)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activeDocMeta, setActiveDocMeta] = useState<DocumentMetadata | null>(null)
  const [activeSections, setActiveSections] = useState<DocumentSection[] | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)

  const cacheDocuments = useCallback((docs: DocumentMetadata[]) => {
    if (!docs || docs.length === 0) {
      return
    }
    setDocumentCache((prev) => {
      const next = { ...prev }
      for (const doc of docs) {
        if (doc?.doc_id) {
          next[doc.doc_id] = doc
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    documentCacheRef.current = documentCache
  }, [documentCache])


  const fetchCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true)
      setCompaniesError(null)

      // Use a wildcard match to return a broad set of companies.
      const result = await api.searchCompanies({
        has_documents_only: true,
        limit: COMPANY_FETCH_LIMIT,
      })
      setCompanies(sortCompanies(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load companies"
      setCompaniesError(message)
      console.error("[TenKExplorer] Failed to load companies", error)
    } finally {
      setCompaniesLoading(false)
    }
  }, [])

  const selectedCompaniesList = useMemo(
    () => Object.values(selectedCompanies),
    [selectedCompanies]
  )

  const selectedTickers = useMemo(
    () => selectedCompaniesList.map((company) => company.ticker).filter(Boolean),
    [selectedCompaniesList]
  )

  const selectedTickersKey = selectedTickers.join(",")

  const companyByCik = useMemo(() => {
    const map = new Map<number, CompanyTickerExchange>()
    for (const company of companies) {
      map.set(company.cik, company)
    }
    return map
  }, [companies])

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  )

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
  )

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    const term = companySearch.trim()

    if (term === "") {
      setSearchResults(undefined)
      return
    }

    const namePattern = term
        const requests = [
          api.searchCompanies({
            name: namePattern,
            limit: COMPANY_SEARCH_LIMIT,
            has_documents_only: true,
          }),
        ]

        if (/^[A-Za-z0-9.-]{1,6}$/.test(term)) {
          requests.push(
            api.searchCompanies({
              ticker: term.toUpperCase(),
              limit: COMPANY_SEARCH_LIMIT,
              has_documents_only: true,
            })
          )
        }

    Promise.all(requests)
      .then((responses) => {
        const merged = new Map<number, CompanyTickerExchange>()
        responses.flat().forEach((company) => {
          merged.set(company.cik, company)
        })
        setSearchResults(sortCompanies(Array.from(merged.values())))
      })
      .catch((error) => {
        console.warn("[TenKExplorer] Company search failed", error)
        setSearchResults([])
      })
  }, [companySearch])

  const selectedCount = selectedCompaniesList.length

  const clearSelectedCompanies = useCallback(() => {
    setSelectedCompanies({})
    console.log("[TenKExplorer] Selected companies cleared")
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
      console.log(`[TenKExplorer] Selected companies: ${tickerSummary}`)

      return next
    })
  }, [])

  useEffect(() => {
    const activeQuery = query.trim()
    const hasTickers = selectedTickers.length > 0

    if (!activeQuery && !hasTickers) {
      setResultsLoading(false)
      setResultsError(null)
      setSearchResponse(null)
      setDocumentResults([])
      return
    }

    let cancelled = false

    const fetchResults = async () => {
      setResultsLoading(true)
      setResultsError(null)

      try {
        if (activeQuery) {
          const request: {
            query: string
            limit: number
            tickers?: string[]
          } = {
            query: activeQuery,
            limit: SEARCH_RESULTS_LIMIT,
          }

          if (hasTickers) {
            request.tickers = selectedTickers
          }

          let response: SearchResponse
          if (searchMode === "fts") {
            response = await api.searchFTS(request)
          } else if (searchMode === "vector") {
            response = await api.searchVector(request)
          } else {
            response = await api.searchHybrid(request)
          }

          if (cancelled) return

          setSearchResponse(response)
          setDocumentResults([])

          const docIds = response.results
            .map((item) => item.doc_id)
            .filter((id): id is string => Boolean(id))

          const missingDocIds = docIds.filter((id) => !documentCacheRef.current[id])

          if (missingDocIds.length > 0) {
            const docs = await Promise.all(
              missingDocIds.map(async (docId) => {
                try {
                  return await api.getDocumentById(docId)
                } catch (error) {
                  console.warn(`[TenKExplorer] Failed to fetch document metadata for ${docId}`, error)
                  return null
                }
              })
            )

            if (!cancelled) {
              cacheDocuments(docs.filter((doc): doc is DocumentMetadata => Boolean(doc)))
            }
          }
        } else if (hasTickers) {
          const response = await api.searchDocuments({
            tickers: selectedTickers.join(","),
            limit: DOCUMENT_RESULTS_LIMIT,
          })

          if (cancelled) return

          const sortedDocs = [...response].sort((a, b) => {
            const yearA = Number(a.year) || 0
            const yearB = Number(b.year) || 0
            return yearB - yearA
          })

          setDocumentResults(sortedDocs)
          setSearchResponse(null)
          cacheDocuments(sortedDocs)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load filings"
          setResultsError(message)
          setSearchResponse(null)
          setDocumentResults([])
        }
      } finally {
        if (!cancelled) {
          setResultsLoading(false)
        }
      }
    }

    fetchResults()

    return () => {
      cancelled = true
    }
  }, [cacheDocuments, query, searchMode, selectedTickersKey])

  const extractYear = (doc?: DocumentMetadata, filename?: string | null) => {
    if (doc?.year) {
      return String(doc.year)
    }

    if (filename) {
      const match = filename.match(/(19|20)\d{2}/)
      if (match) {
        return match[0]
      }
    }

    return "—"
  }

  const formatDocumentStats = (doc: DocumentMetadata) => {
    const parts: string[] = []
    if (doc.total_sections) {
      parts.push(`${doc.total_sections} sections`)
    }
    if (doc.total_chars) {
      parts.push(`${numberFormatter.format(doc.total_chars)} chars`)
    }
    return parts.join(" • ")
  }

  const getCompanyInfo = (cik: string, fallbackName?: string | null) => {
    const numericCik = Number(cik)
    const company = Number.isNaN(numericCik) ? undefined : companyByCik.get(numericCik)
    return {
      name: fallbackName ?? company?.name ?? `CIK ${cik}`,
      ticker: company?.ticker ?? `CIK ${cik}`,
    }
  }

  const openDocumentDrawer = useCallback(
    async (docId: string, fallbackMeta?: DocumentMetadata | null) => {
      if (!docId) {
        return
      }

      setActiveDocId(docId)
      setDrawerLoading(true)
      setDrawerError(null)
      setActiveSections(null)

      const cachedMeta = documentCacheRef.current[docId] ?? fallbackMeta ?? null

      if (cachedMeta) {
        setActiveDocMeta(cachedMeta)
      } else {
        try {
          const fetchedMeta = await api.getDocumentById(docId)
          cacheDocuments([fetchedMeta])
          setActiveDocMeta(fetchedMeta)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load document metadata"
          setDrawerError(message)
        }
      }

      try {
        const sections = await api.getDocumentSections(docId)
        setActiveSections(sections)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load sections"
        setDrawerError(message)
      } finally {
        setDrawerLoading(false)
      }
    },
    [cacheDocuments]
  )

  const closeDocumentDrawer = useCallback(() => {
    setActiveDocId(null)
    setActiveDocMeta(null)
    setActiveSections(null)
    setDrawerError(null)
    setDrawerLoading(false)
  }, [])

  useEffect(() => {
    if (!activeDocId) {
      return
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDocumentDrawer()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeDocId, closeDocumentDrawer])

  const formatSectionName = (raw?: string | null) => {
    if (!raw) {
      return null
    }

    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }

    const lowered = trimmed.toLowerCase()
    const directKey = lowered.replace(/[\s-]+/g, "_")
    if (SECTION_DISPLAY_MAP[directKey]) {
      return SECTION_DISPLAY_MAP[directKey]
    }

    const compact = lowered.replace(/[_\s.-]+/g, "")
    const sectionKey = `section_${compact.replace(/^item/, "").replace(/^section/, "")}`
    if (SECTION_DISPLAY_MAP[sectionKey]) {
      return SECTION_DISPLAY_MAP[sectionKey]
    }

    const sectionMatch = lowered.match(/^(?:section[\s_]*)(\d+[a-z]?)/i)
    if (sectionMatch) {
      const key = `section_${sectionMatch[1].toLowerCase()}`
      if (SECTION_DISPLAY_MAP[key]) {
        return SECTION_DISPLAY_MAP[key]
      }
    }

    const itemMatch = lowered.match(/^(item\s*\d+[a-z]?)/i)
    if (itemMatch) {
      const key = `section_${itemMatch[1]
        .replace(/item\s*/, "")
        .replace(/\s+/g, "")
        .toLowerCase()}`
      if (SECTION_DISPLAY_MAP[key]) {
        return SECTION_DISPLAY_MAP[key]
      }
      return itemMatch[1].replace(/\s+/g, " ").toUpperCase()
    }

    const normalized = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ")

    return normalized
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const renderSearchResultCard = (item: SearchResultItem) => {
    const docMeta = item.doc_id ? documentCache[item.doc_id] : undefined
    const score = item.combined_score ?? item.vector_score ?? item.fts_score ?? undefined
    const yearLabel = extractYear(docMeta, item.filename)
    const sectionLabel = formatSectionName(item.section_name)

    return (
      <SearchResultCard
        key={`${item.doc_id}-${item.chunk_id}`}
        result={item}
        documentMeta={docMeta}
        sectionLabel={sectionLabel}
        yearLabel={yearLabel}
        score={score}
        onOpen={openDocumentDrawer}
        snippetStyle={SNIPPET_CLAMP_STYLE}
        formatCompany={getCompanyInfo}
      />
    )
  }

  const renderDocumentCard = (doc: DocumentMetadata) => {
    const yearLabel = extractYear(doc, doc.filename)
    const stats = formatDocumentStats(doc)
    const ingestedLabel =
      doc.ingested_at && !Number.isNaN(Date.parse(doc.ingested_at))
        ? dateFormatter.format(new Date(doc.ingested_at))
        : null

    return (
      <DocumentCard
        key={doc.doc_id}
        document={doc}
        yearLabel={yearLabel}
        stats={stats}
        ingestedLabel={ingestedLabel}
        onOpen={openDocumentDrawer}
        formatCompany={getCompanyInfo}
        numberFormatter={numberFormatter}
      />
    )
  }

  const renderResultsPane = () => {
    const activeQuery = query.trim()
    const hasQuery = activeQuery.length > 0
    const hasSelections = selectedCount > 0

    if (!hasQuery && !hasSelections) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-center text-slate-500 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Start by searching filings or selecting companies
          </p>
          <p className="text-xs text-slate-500">
            Use the global search above or pick tickers on the left to explore 10-Ks.
          </p>
        </div>
      )
    }

    if (resultsLoading) {
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500 shadow-sm">
          Loading filings…
        </div>
      )
    }

    if (resultsError) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 shadow-sm">
          <p className="font-medium">Unable to load filings</p>
          <p className="text-xs text-red-500">{resultsError}</p>
        </div>
      )
    }

    if (hasQuery) {
      const results = searchResponse?.results ?? []
      if (results.length === 0) {
        return (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            <p className="font-medium text-slate-600">No matches for “{activeQuery}”</p>
            <p className="text-xs text-slate-500">
              Try adjusting keywords or choosing different search modes.
            </p>
          </div>
        )
      }

      return <div className="space-y-4">{results.map((item) => renderSearchResultCard(item))}</div>
    }

    if (documentResults.length === 0) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          <p className="font-medium text-slate-600">No filings available</p>
          <p className="text-xs text-slate-500">
            We couldn’t find any filings for the selected companies.
          </p>
        </div>
      )
    }

    return <div className="space-y-4">{documentResults.map((doc) => renderDocumentCard(doc))}</div>
  }

  const renderCompanyList = () => {
    const termActive = companySearch.trim() !== ""
    const loading = termActive ? false : companiesLoading
    const error = termActive ? null : companiesError
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
    <>
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
        <div className="flex w-full items-center gap-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filings…"
            className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
          />
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-1 text-xs font-medium text-slate-500 shadow-sm">
            {SEARCH_MODE_OPTIONS.map((mode) => {
              const isActive = searchMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setSearchMode(mode.id)
                    console.log(`[TenKExplorer] Search mode: ${mode.id}`)
                  }}
                  className={`rounded-md px-3 py-1 transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {mode.label}
                </button>
              )
            })}
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
        {renderResultsPane()}
      </div>
    </div>

      <TenKDocumentDrawer
        isOpen={Boolean(activeDocId)}
        docId={activeDocId}
        document={activeDocMeta}
        sections={activeSections}
        loading={drawerLoading}
        error={drawerError}
        onClose={closeDocumentDrawer}
        formatSectionName={formatSectionName}
        getCompanyInfo={getCompanyInfo}
      />
    </>
  )
}
