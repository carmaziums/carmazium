"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"

export function LedgerCsvExport({ csv, page, onClose }: { csv: string; page: number; onClose: () => void }) {
    const [notice, setNotice] = React.useState("")
    const preview = React.useRef<HTMLTextAreaElement>(null)
    const titleId = React.useId()
    // A normal download link keeps this small, single-page CSV available for
    // the entire preview lifetime. No temporary blob URL or revocation race.
    const downloadHref = "data:text/csv;charset=utf-8," + encodeURIComponent("\ufeff" + csv)

    async function copy() {
        try {
            await navigator.clipboard.writeText(csv)
            setNotice("CSV copied. Paste it into a spreadsheet or save it as a .csv file.")
        } catch {
            preview.current?.focus()
            preview.current?.select()
            setNotice("Automatic copy is unavailable. The CSV is selected; use your device’s Copy command.")
        }
    }

    return <section aria-labelledby={titleId} className="mb-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
        <h2 id={titleId} className="font-bold">CSV export — page {page}</h2>
        <p className="text-sm text-[var(--text-muted)]">This is a snapshot of the displayed page when you opened the export. If the download does not start, copy the CSV below.</p>
        <div className="flex flex-wrap gap-3">
            <Button asChild><a href={downloadHref} download={`carmazium-transactions-page-${page}.csv`}>Download CSV</a></Button>
            <Button type="button" variant="outline" onClick={copy}>Copy CSV</Button>
            <Button type="button" variant="outline" onClick={onClose}>Close export</Button>
        </div>
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <textarea ref={preview} aria-label="CSV export contents" readOnly value={csv} rows={8} className="w-full rounded-lg border bg-[var(--bg-input)] p-3 font-mono text-xs" />
    </section>
}
