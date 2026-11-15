"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Facebook, Mail, MessageCircle, Share2, X } from "lucide-react"
import { AccessibleModal } from "@/components/ui/AccessibleModal"
import { vehicleShareLinks, vehicleShareNotice, vehicleShareUrl, type ShareableVehicle } from "@/lib/vehicleSharing"

export function VehicleShareDialog({ vehicle, auctionId, onClose }: { vehicle: ShareableVehicle; auctionId?: string | null; onClose: () => void }) {
    const url = vehicleShareUrl(vehicle, auctionId)
    const title = vehicle.title?.trim() || "Vehicle"
    const links = vehicleShareLinks(title, url)
    const input = useRef<HTMLInputElement>(null)
    const [nativeShare, setNativeShare] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    useEffect(() => { setNativeShare(typeof navigator.share === "function") }, [])

    async function copyLink() {
        setMessage("")
        try {
            await navigator.clipboard.writeText(url)
            setMessage("Link copied. Paste it into any app or message.")
        } catch {
            input.current?.focus()
            input.current?.select()
            setMessage("Copying is unavailable in this browser. Select and copy the link below.")
        }
    }
    async function moreApps() {
        if (busy) return
        setBusy(true); setMessage("")
        try {
            await navigator.share({ title, text: `View ${title} on CarMazium`, url })
        } catch (error: unknown) {
            if (!(error instanceof Error && error.name === "AbortError")) setMessage("Your device could not open sharing. Choose WhatsApp, Facebook, email or copy the link instead.")
        } finally { setBusy(false) }
    }
    const optionClass = "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-3 text-sm font-bold hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    return <AccessibleModal label="Share vehicle" onClose={onClose}>
        <div className="max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-xl font-bold">Share this vehicle</h2><p className="mt-1 text-sm break-words text-[var(--text-muted)]">{title}</p></div>
                <button type="button" onClick={onClose} aria-label="Close sharing" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--bg-input)]"><X size={22} /></button>
            </div>
            <p className="my-4 text-sm text-[var(--text-muted)]">{vehicleShareNotice(vehicle, auctionId)}</p>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={`${optionClass} bg-emerald-700 text-white`}><MessageCircle size={20} aria-hidden="true" />WhatsApp<span className="sr-only"> (opens sharing in a new tab)</span></a>
                <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={`${optionClass} bg-blue-700 text-white`}><Facebook size={20} aria-hidden="true" />Facebook<span className="sr-only"> (opens sharing in a new tab)</span></a>
                <a href={links.email} className={optionClass}><Mail size={20} aria-hidden="true" />Email</a>
                <button type="button" onClick={copyLink} className={optionClass}><Copy size={20} aria-hidden="true" />Copy link</button>
                {nativeShare && <button type="button" onClick={moreApps} disabled={busy} className={`${optionClass} min-[360px]:col-span-2 bg-primary text-white disabled:opacity-50`}><Share2 size={20} aria-hidden="true" />{busy ? "Opening sharing…" : "More apps…"}</button>}
            </div>
            <label htmlFor="vehicle-share-link" className="mt-5 mb-2 block text-sm font-semibold">Vehicle link</label>
            <input ref={input} id="vehicle-share-link" value={url} readOnly onFocus={event => event.currentTarget.select()} className="w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm" />
            <p role="status" aria-live="polite" className="mt-3 text-sm">{message}</p>
        </div>
    </AccessibleModal>
}
