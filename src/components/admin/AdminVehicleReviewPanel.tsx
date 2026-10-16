"use client"

import * as React from "react"
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Send, Pencil } from "lucide-react"
import { getAdminVehicleReviewItems } from "@/lib/adminVehicleReview"
import { refreshAdminOfficialVehicleData, requestAdminSellerVehicleDetails } from "@/lib/adminApi"

/**
 * Rendered only inside the admin listings route. API actions are separately
 * protected by SessionAuthGuard + ADMIN role on the server.
 */
export function AdminVehicleReviewPanel({ listing, onEdit, onUpdated }: {
  listing: any
  onEdit: () => void
  onUpdated: () => void
}) {
  const items = getAdminVehicleReviewItems(listing)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<'official' | 'seller' | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [excluded, setExcluded] = React.useState<string[]>([])

  if (!items.length) return null

  const officialItems = items.filter(item => item.official)
  const sellerFields = items.filter(item => item.sellerField)
  const chosen = [...new Set(sellerFields
    .filter(item => !excluded.includes(item.sellerField!))
    .map(item => item.sellerField!))]

  async function refreshOfficial() {
    setBusy('official')
    setError(null)
    setNotice(null)
    try {
      const result = await refreshAdminOfficialVehicleData(listing.id)
      const filled = result.updated.reduce((sum, row) => sum + row.fields.length, 0)
      setNotice(filled
        ? `Updated ${filled} previously empty official fields across ${result.updated.length} listing(s).`
        : result.message + (result.officialMotTestsAvailable ? '' : ' MOT test history was not returned.'))
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Official vehicle information is unavailable')
    } finally {
      setBusy(null)
    }
  }

  async function requestSeller() {
    if (!chosen.length) return
    setBusy('seller')
    setError(null)
    setNotice(null)
    try {
      await requestAdminSellerVehicleDetails(listing.id, chosen)
      setNotice('Seller notified in-app about: ' + sellerFields
        .filter(item => item.sellerField && chosen.includes(item.sellerField))
        .map(item => item.label).join(', ') + '.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify the seller')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-2 max-w-xl text-left">
      <button type="button" onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle size={13} className="shrink-0" />
        <span>{items.length} fields need review</span>
        <ChevronDown size={13} className={open ? "rotate-180" : ""} />
      </button>
      <p className="mt-1 text-[11px] text-[var(--text-muted)] break-words">
        Missing: {items.map(item => item.label).join(', ')}
      </p>
      {open && (
        <section className="mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-xs"
          aria-label="Admin-only missing vehicle field details">
          <p className="mb-2 font-semibold">Admin review — not shown to buyers or sellers</p>
          <p className="mb-3 text-[var(--text-muted)]">Each field is currently blank. Government records and seller declarations have different correction paths. BHP, MPG, equipment and map coordinates are not automatically treated as errors.</p>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.field} className="rounded-lg border border-[var(--border-default)] p-2">
                <p className="font-semibold">{item.label} <span className="font-normal text-[var(--text-muted)]">· {item.source}</span></p>
                <p className="mt-1">Saved value: <strong>{item.currentValue}</strong></p>
                <p className="mt-1 text-[var(--text-muted)]">{item.explanation}</p>
                {item.sellerField && (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={!excluded.includes(item.sellerField)}
                      onChange={e => setExcluded(previous => e.target.checked
                        ? previous.filter(field => field !== item.sellerField)
                        : [...previous, item.sellerField!])} />
                    Include in seller request
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {officialItems.length > 0 && (
              <button type="button" onClick={refreshOfficial} disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 font-semibold disabled:opacity-50">
                {busy === 'official' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Recheck DVLA / MOT
              </button>
            )}
            {chosen.length > 0 && (
              <button type="button" onClick={requestSeller} disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-semibold disabled:opacity-50">
                {busy === 'seller' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Ask seller ({chosen.length})
              </button>
            )}
            <button type="button" onClick={onEdit} disabled={!!busy}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-2 font-semibold disabled:opacity-50">
              <Pencil size={13} /> Correct as admin
            </button>
          </div>
          {notice && <p role="status" className="mt-2 text-emerald-600 dark:text-emerald-300">{notice}</p>}
          {error && <p role="alert" className="mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </section>
      )}
    </div>
  )
}
