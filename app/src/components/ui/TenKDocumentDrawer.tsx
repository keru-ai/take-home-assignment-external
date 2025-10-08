import { X } from "lucide-react"

import type { DocumentMetadata, DocumentSection } from "@/lib/api-client"

type TenKDocumentDrawerProps = {
  isOpen: boolean
  docId: string | null
  document: DocumentMetadata | null
  sections: DocumentSection[] | null
  loading: boolean
  error: string | null
  onClose: () => void
  formatSectionName: (raw?: string | null) => string | null
  getCompanyInfo: (cik: string, fallbackName?: string | null) => { name: string; ticker: string }
}

export function TenKDocumentDrawer({
  isOpen,
  docId,
  document,
  sections,
  loading,
  error,
  onClose,
  formatSectionName,
  getCompanyInfo,
}: TenKDocumentDrawerProps) {
  if (!isOpen || !docId) {
    return null
  }

  const companyLabel =
    document && document.cik
      ? getCompanyInfo(
          document.cik,
          (document as unknown as { company_name?: string | null })?.company_name ?? null,
        ).name
      : docId

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full w-full flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-slate-500">Document</span>
              <h2 className="text-lg font-semibold text-slate-900">
                {document ? `${document.year} • ${companyLabel}` : docId}
              </h2>
              {document ? (
                <p className="text-xs text-slate-500">CIK {document.cik}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading document…</p>
            ) : error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            ) : sections && sections.length > 0 ? (
              <div className="space-y-6">
                {sections.map((section) => (
                  <section key={section.section_id} className="space-y-3">
                    <header>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {formatSectionName(section.section_name) ?? section.section_name}
                      </h3>
                    </header>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {section.content || "No content available"}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sections available for this document.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
