"use client"

import React, { useState } from "react"
import { X, Link2, Loader2, CheckCircle, AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { previewImport, importFromUrl, createListingCheckout, type ScrapedListingPreview } from "@/lib/listingApi"

const PLATFORM_LABELS: Record<string, string> = {
    CARGURUS: "CarGurus",
    AUTOTRADER: "AutoTrader",
    CARWOW: "CarWow",
}

const PLATFORM_COLOURS: Record<string, string> = {
    CARGURUS: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    AUTOTRADER: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    CARWOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
}

interface Props {
    onClose: () => void
    onImported?: (listingId: string) => void
}

type Step = 'url' | 'preview' | 'review' | 'done'

export function ImportListingModal({ onClose, onImported }: Props) {
    const [step, setStep] = useState<Step>('url')
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<ScrapedListingPreview | null>(null)

    // Editable fields (user can fix what the scraper got wrong)
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [vrm, setVrm] = useState("")
    const [badgeTier, setBadgeTier] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('BASIC')

    const [importedListingId, setImportedListingId] = useState<string | null>(null)
    const [checkoutLoading, setCheckoutLoading] = useState(false)

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
        if (!preview || !price || !vrm) return
        setLoading(true)
        setError(null)
        try {
            const listing = await importFromUrl({
                url: url.trim(),
                price: Number(price),
                vrm: vrm.trim().toUpperCase(),
                badgeTier,
                title: title.trim() || undefined,
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

    const handleProceedToPayment = async () => {
        if (!importedListingId) return
        setCheckoutLoading(true)
        try {
            const { url: checkoutUrl } = await createListingCheckout(importedListingId, badgeTier)
            window.location.href = checkoutUrl
        } catch (e: any) {
            setError(e.message ?? "Failed to start checkout.")
            setCheckoutLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Link2 size={18} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white font-heading">Import Listing</h2>
                            <p className="text-xs text-gray-400">
                                {step === 'url' && "Paste a link from AutoTrader, CarGurus, or CarWow"}
                                {step === 'preview' && "Review extracted data"}
                                {step === 'done' && "Listing imported successfully"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* ── Step 1: URL input ── */}
                    {step === 'url' && (
                        <>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-300 block">Listing URL</label>
                                <Input
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFetchPreview()}
                                    placeholder="https://www.cargurus.co.uk/details/157301480"
                                    className="bg-slate-800 border-white/10 text-white font-mono text-sm"
                                    autoFocus
                                />
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">cargurus.co.uk</span>
                                    <span className="px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">autotrader.co.uk</span>
                                    <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">carwow.co.uk</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    We&apos;ll extract the vehicle details automatically. You can review and edit everything before publishing.
                                </p>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <Button
                                onClick={handleFetchPreview}
                                disabled={loading || !url.trim()}
                                className="w-full shadow-neon"
                            >
                                {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Fetching listing...</> : "Extract Listing Data"}
                            </Button>
                        </>
                    )}

                    {/* ── Step 2: Preview + edit ── */}
                    {step === 'preview' && preview && (
                        <>
                            {/* Platform badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${PLATFORM_COLOURS[preview.platform] ?? 'text-gray-400'}`}>
                                <ExternalLink size={12} />
                                Imported from {PLATFORM_LABELS[preview.platform] ?? preview.platform}
                            </div>

                            {/* Scraped images preview */}
                            {preview.images.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {preview.images.slice(0, 6).map((src, i) => (
                                        <img
                                            key={i}
                                            src={src}
                                            alt={`Photo ${i + 1}`}
                                            className="h-20 w-28 object-cover rounded-lg flex-shrink-0 border border-white/10"
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                        />
                                    ))}
                                    {preview.images.length > 6 && (
                                        <div className="h-20 w-28 flex-shrink-0 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center">
                                            <span className="text-xs text-gray-400">+{preview.images.length - 6} more</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {preview.images.length === 0 && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                                    <ImageIcon size={14} /> No images were extracted. You can add photos after importing.
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {/* Scraped read-only info */}
                                {[
                                    { label: "Make", value: preview.make },
                                    { label: "Model", value: preview.model },
                                    { label: "Year", value: preview.year },
                                    { label: "Mileage", value: preview.mileage ? `${preview.mileage.toLocaleString()} miles` : undefined },
                                    { label: "Fuel", value: preview.fuelType },
                                    { label: "Gearbox", value: preview.transmission },
                                    { label: "Colour", value: preview.color },
                                    { label: "Body type", value: preview.bodyType },
                                    { label: "Engine", value: preview.engineSize ? `${(preview.engineSize / 1000).toFixed(1)}L` : undefined },
                                    { label: "BHP", value: preview.bhp },
                                ].filter(f => f.value).map(({ label, value }) => (
                                    <div key={label} className="bg-slate-800/60 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                                        <p className="text-sm text-white font-medium">{String(value)}</p>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-white/10" />

                            {/* Editable fields */}
                            <p className="text-xs text-gray-400">Review and edit the fields below before importing. Fields marked with * are required.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Title *</label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-800 border-white/10 text-white text-sm" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Asking Price (£) *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                                            <Input
                                                type="number"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                className="bg-slate-800 border-white/10 text-white text-sm pl-7"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Registration (VRM) *</label>
                                        <Input
                                            value={vrm}
                                            onChange={e => setVrm(e.target.value.toUpperCase())}
                                            className="bg-slate-800 border-white/10 text-white text-sm font-mono tracking-widest"
                                            placeholder="AB12 CDE"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Listing Plan</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["BASIC", "STANDARD", "PREMIUM"] as const).map(tier => (
                                            <button
                                                key={tier}
                                                onClick={() => setBadgeTier(tier)}
                                                className={`rounded-lg px-3 py-2.5 text-sm font-semibold border transition-all ${badgeTier === tier
                                                    ? 'bg-primary/20 border-primary text-white'
                                                    : 'bg-slate-800 border-white/10 text-gray-400 hover:border-white/30'}`}
                                            >
                                                {tier}
                                                <span className="block text-[10px] font-normal text-gray-500 mt-0.5">
                                                    {tier === 'BASIC' ? '£1' : tier === 'STANDARD' ? '£10' : '£25'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" onClick={() => { setStep('url'); setError(null) }} className="border-white/10 text-gray-400">
                                    ← Back
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={loading || !price || !vrm || !title}
                                    className="flex-1 shadow-neon"
                                >
                                    {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Importing...</> : "Import as Draft"}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Done ── */}
                    {step === 'done' && (
                        <div className="text-center space-y-6 py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Listing Imported!</h3>
                                <p className="text-sm text-gray-400">
                                    Your listing has been created as a Draft. Pay to activate it and make it visible to buyers.
                                </p>
                            </div>

                            {error && <ErrorBox message={error} />}

                            <div className="flex flex-col gap-3">
                                <Button onClick={handleProceedToPayment} disabled={checkoutLoading} className="shadow-neon">
                                    {checkoutLoading ? <><Loader2 size={16} className="animate-spin mr-2" />Redirecting...</> : `Activate Listing (£${badgeTier === 'BASIC' ? 1 : badgeTier === 'STANDARD' ? 10 : 25})`}
                                </Button>
                                <Button variant="outline" onClick={onClose} className="border-white/10 text-gray-400">
                                    Do it later
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
