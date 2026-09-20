"use client"

import React, { useState } from "react"
import { X, Link2, Loader2, CheckCircle, AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { previewImport, importFromUrl, createListingCheckout, type ScrapedListingPreview } from "@/lib/listingApi"

const PLATFORM_LABELS: Record<string, string> = {
    CARGURUS: 'CarGurus',
    AUTOTRADER: 'AutoTrader',
    CARWOW: 'CarWow',
}

const PLATFORM_BADGE: Record<string, string> = {
    CARGURUS: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    AUTOTRADER: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    CARWOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
    onClose: () => void
    onImported?: (listingId: string) => void
}

type Step = 'url' | 'preview' | 'done'

export function ImportListingModal({ onClose, onImported }: Props) {
    // Step state
    const [step, setStep] = useState<Step>('url')

    // URL step
    const [url, setUrl] = useState("")

    // Preview step
    const [preview, setPreview] = useState<ScrapedListingPreview | null>(null)
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [vrm, setVrm] = useState("")

    // Done step
    const [importedListingId, setImportedListingId] = useState<string | null>(null)

    // Shared
    const [loading, setLoading] = useState(false)
    const [checkoutLoading, setCheckoutLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleFetchPreview = async () => {
        if (!url.trim()) return
        setLoading(true)
        setError(null)
        try {
            const data = await previewImport(url.trim())
            setPreview(data)
            setTitle(data.title ?? "")
            setPrice(data.price ? String(Math.round(data.price)) : "")
            setVrm(data.vrm ?? "")
            setStep('preview')
        } catch (e: any) {
            setError(e.message ?? "Failed to fetch listing. Check the URL and try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (!preview || !price || !vrm || !title) return
        setLoading(true)
        setError(null)
        try {
            // Import as DRAFT — no plan yet, user picks it on the next screen
            const listing = await importFromUrl({
                url: url.trim(),
                price: Number(price),
                vrm: vrm.trim().toUpperCase(),
                title: title.trim(),
            })
            setImportedListingId(listing.id)
            setStep('done')
            onImported?.(listing.id)
        } catch (e: any) {
            setError(e.message ?? "Failed to import listing. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleActivate = async () => {
        if (!importedListingId) return
        setCheckoutLoading(true)
        setError(null)
        try {
            const { url: checkoutUrl } = await createListingCheckout(importedListingId, 'BASIC')
            window.location.href = checkoutUrl
        } catch (e: any) {
            setError(e.message ?? "Failed to start checkout.")
            setCheckoutLoading(false)
        }
    }

    const stepLabels: Record<Step, string> = {
        url: 'Paste a link from AutoTrader, CarGurus, or CarWow',
        preview: 'Review extracted data',
        done: 'Retail listing fee',
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="relative bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[var(--bg-dropdown)] z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Link2 size={18} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">Import Listing</h2>
                            <p className="text-xs text-[var(--text-muted)]">{stepLabels[step]}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1.5 px-6 pt-4">
                    {(['url', 'preview', 'done'] as Step[]).map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-all ${
                                s === step ? 'bg-primary' :
                                (['url', 'preview', 'done'] as Step[]).indexOf(s) < (['url', 'preview', 'done'] as Step[]).indexOf(step)
                                    ? 'bg-primary/40' : 'bg-white/10'
                            }`}
                        />
                    ))}
                </div>

                <div className="p-6 space-y-5">

                    {/* ── Step 1: URL ── */}
                    {step === 'url' && (
                        <>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-[var(--text-secondary)] block">Listing URL</label>
                                <Input
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFetchPreview()}
                                    placeholder="https://www.cargurus.co.uk/details/157301480"
                                    className="bg-[var(--bg-input)] border-[var(--border-default)] font-mono text-sm"
                                    autoFocus
                                />
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: 'cargurus.co.uk', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                                        { label: 'autotrader.co.uk', cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                                        { label: 'carwow.co.uk', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                                    ].map(({ label, cls }) => (
                                        <span key={label} className={`px-2 py-1 rounded text-xs border ${cls}`}>{label}</span>
                                    ))}
                                </div>
                                <p className="text-xs text-[var(--text-muted)]">
                                    We&apos;ll extract vehicle details automatically. You can review and edit everything before saving the draft.
                                </p>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <Button onClick={handleFetchPreview} disabled={loading || !url.trim()} className="w-full shadow-neon">
                                {loading
                                    ? <><Loader2 size={16} className="animate-spin mr-2" /> Fetching listing…</>
                                    : 'Extract Listing Data'}
                            </Button>
                        </>
                    )}

                    {/* ── Step 2: Preview + editable fields ── */}
                    {step === 'preview' && preview && (
                        <>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${PLATFORM_BADGE[preview.platform] ?? 'text-[var(--text-muted)] border-gray-600'}`}>
                                <ExternalLink size={12} />
                                Imported from {PLATFORM_LABELS[preview.platform] ?? preview.platform}
                            </div>

                            {/* Image strip */}
                            {preview.images.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {preview.images.slice(0, 6).map((src, i) => (
                                        <img
                                            key={i}
                                            src={src}
                                            alt=""
                                            className="h-20 w-28 object-cover rounded-lg flex-shrink-0 border border-[var(--border-default)]"
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                        />
                                    ))}
                                    {preview.images.length > 6 && (
                                        <div className="h-20 w-28 flex-shrink-0 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center">
                                            <span className="text-xs text-[var(--text-muted)]">+{preview.images.length - 6}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                                    <ImageIcon size={14} /> No images extracted — you can add photos after importing.
                                </div>
                            )}

                            {/* Read-only scraped spec chips */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Make', value: preview.make },
                                    { label: 'Model', value: preview.model },
                                    { label: 'Year', value: preview.year },
                                    { label: 'Mileage', value: preview.mileage ? `${preview.mileage.toLocaleString()} miles` : undefined },
                                    { label: 'Fuel', value: preview.fuelType },
                                    { label: 'Gearbox', value: preview.transmission },
                                    { label: 'Colour', value: preview.color },
                                    { label: 'Body', value: preview.bodyType },
                                    { label: 'Engine', value: preview.engineSize ? `${(preview.engineSize / 1000).toFixed(1)}L` : undefined },
                                    { label: 'BHP', value: preview.bhp },
                                ].filter(f => f.value).map(({ label, value }) => (
                                    <div key={label} className="bg-[var(--bg-input)] rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
                                        <p className="text-sm text-[var(--text-primary)] font-medium">{String(value)}</p>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-[var(--border-default)]" />

                            <p className="text-xs text-[var(--text-muted)]">Confirm or correct the key details below before saving.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Title *</label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-[var(--bg-input)] border-[var(--border-default)] text-sm" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Asking Price *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">£</span>
                                            <Input
                                                type="number"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] text-sm pl-7"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Registration (VRM) *</label>
                                        <Input
                                            value={vrm}
                                            onChange={e => setVrm(e.target.value.toUpperCase())}
                                            className="bg-[var(--bg-input)] border-[var(--border-default)] text-sm font-mono tracking-widest"
                                            placeholder="AB12 CDE"
                                        />
                                    </div>
                                </div>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" onClick={() => { setStep('url'); setError(null) }} className="border-[var(--border-default)] text-[var(--text-muted)]">
                                    ← Back
                                </Button>
                                <Button onClick={handleImport} disabled={loading || !price || !vrm || !title} className="flex-1 shadow-neon">
                                    {loading
                                        ? <><Loader2 size={16} className="animate-spin mr-2" />Saving…</>
                                        : 'Save & Continue →'}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Fixed retail listing fee ── */}
                    {step === 'done' && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle size={18} className="text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Listing saved as draft</p>
                                    <p className="text-xs text-[var(--text-muted)]">Complete the one-off £1 retail listing payment when you are ready to submit it.</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Retail Listing</p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">One simple listing price. No Basic, Standard or Premium packages.</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-[var(--text-primary)]">£1</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">one-off</p>
                                    </div>
                                </div>
                                <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
                                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400" /> Advertised until sold</li>
                                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400" /> Offers, negotiation and buyer chat</li>
                                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400" /> HPI and Featured Boost remain optional</li>
                                </ul>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <div className="flex flex-col gap-3 pt-1">
                                <Button onClick={handleActivate} disabled={checkoutLoading} className="w-full shadow-neon">
                                    {checkoutLoading
                                        ? <><Loader2 size={16} className="animate-spin mr-2" />Redirecting to payment…</>
                                        : <>Pay £1 & Submit Listing <ExternalLink size={14} className="ml-2" /></>}
                                </Button>
                                <Button variant="outline" onClick={onClose} className="border-[var(--border-default)] text-[var(--text-muted)] text-sm">
                                    Do it later — listing saved in My Inventory
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{message}</span>
        </div>
    )
}
