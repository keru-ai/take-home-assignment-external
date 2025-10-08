import { ArrowRight } from "lucide-react"

import type { DocumentMetadata } from "@/lib/api-client"

export type DocumentCardProps = {
  document: DocumentMetadata
  yearLabel: string
  stats: string
  ingestedLabel: string | null
  onOpen: (docId: string, meta?: DocumentMetadata | null) => void
  formatCompany: (cik: string, fallbackName?: string | null) => { name: string; ticker: string }
  numberFormatter: Intl.NumberFormat
}

export function DocumentCard({
  document,
  yearLabel,
  stats,
  ingestedLabel,
  onOpen,
  formatCompany,
  numberFormatter,
}: DocumentCardProps) {
  const { name, ticker } = formatCompany(document.cik, undefined)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(document.doc_id, document)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(document.doc_id, document)
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
            {stats ? <span className="text-xs text-slate-500">{stats}</span> : null}
          </div>
          <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {yearLabel}
          </div>
        </div>

        <div className="text-sm text-slate-600">{document.filename}</div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>Sections: {document.total_sections ?? "—"}</span>
          <span>
            Characters: {document.total_chars ? numberFormatter.format(document.total_chars) : "—"}
          </span>
          {ingestedLabel ? <span>Ingested {ingestedLabel}</span> : null}
        </div>
      </div>
      <div className="flex w-12 items-center justify-center border-l border-slate-200 text-slate-400">
        <ArrowRight className="h-5 w-5" />
      </div>
    </div>
  )
}
