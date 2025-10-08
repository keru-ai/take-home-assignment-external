import type { CSSProperties } from "react"

import { ArrowRight } from "lucide-react"

import type { DocumentMetadata, SearchResultItem } from "@/lib/api-client"

type SearchResultCardProps = {
  result: SearchResultItem
  documentMeta?: DocumentMetadata | null
  sectionLabel?: string | null
  yearLabel: string
  score?: number
  onOpen: (docId: string, meta?: DocumentMetadata | null) => void
  snippetStyle: CSSProperties
  formatCompany: (cik: string, fallbackName?: string | null) => { name: string; ticker: string }
}

export function SearchResultCard({
  result,
  documentMeta,
  sectionLabel,
  yearLabel,
  score,
  onOpen,
  snippetStyle,
  formatCompany,
}: SearchResultCardProps) {
  const { name, ticker } = formatCompany(result.cik, result.company_name)
  const docMeta = documentMeta ?? undefined

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(result.doc_id ?? "", docMeta)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(result.doc_id ?? "", docMeta)
        }
      }}
      className="flex cursor-pointer rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400"
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="max-w-md truncate text-base font-semibold text-slate-900">
                {name}
              </h3>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                {ticker}
              </span>
            </div>
            {sectionLabel ? (
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {sectionLabel}
              </span>
            ) : null}
          </div>
          <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {yearLabel}
          </div>
        </div>

        {result.chunk_text ? (
          <p className="text-sm leading-relaxed text-slate-600" style={snippetStyle}>
            {result.chunk_text}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>{docMeta?.filename ?? result.filename ?? "Document"}</span>
          {score !== undefined ? (
            <span>Score: {score >= 1 ? score.toFixed(2) : score.toFixed(3)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex w-12 items-center justify-center border-l border-slate-200 text-slate-400">
        <ArrowRight className="h-5 w-5" />
      </div>
    </div>
  )
}
