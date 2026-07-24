"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Megaphone, Upload, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getMarketingPopupConfig, updateMarketingPopupConfig, type MarketingPopupConfig } from "@/lib/marketingApi"
import { uploadImage } from "@/lib/supabase"

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback
}

export default function AdminMarketingPopupPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [config, setConfig] = React.useState<MarketingPopupConfig | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null)
    const [linkUrlDraft, setLinkUrlDraft] = React.useState("")
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchConfig = React.useCallback(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        getMarketingPopupConfig()
            .then((cfg) => { setConfig(cfg); setLinkUrlDraft(cfg.linkUrl) })
            .catch(err => setError(err.message || 'Failed to load popup config'))
            .finally(() => setLoading(false))
    }, [profile])

    React.useEffect(() => { fetchConfig() }, [fetchConfig])

    const flashSaved = (msg: string) => {
        setSavedMsg(msg)
        window.setTimeout(() => setSavedMsg(null), 2500)
    }

    const handleToggleEnabled = async () => {
        if (!config) return
        const next = !config.enabled
        setSaving(true)
        setError(null)
        try {
            const updated = await updateMarketingPopupConfig({ enabled: next })
            setConfig(updated)
            flashSaved(next ? 'Popup enabled' : 'Popup disabled')
        } catch (err) {
            setError(errorMessage(err, 'Failed to update'))
        } finally {
            setSaving(false)
        }
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.')
            return
        }
        setUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, 'listings', 'marketing-popup')
            const updated = await updateMarketingPopupConfig({ imageUrl: url })
            setConfig(updated)
            flashSaved('Image updated')
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleSaveLink = async () => {
        if (!config || linkUrlDraft === config.linkUrl) return
        setSaving(true)
        setError(null)
        try {
            const updated = await updateMarketingPopupConfig({ linkUrl: linkUrlDraft || '/auctions' })
            setConfig(updated)
            flashSaved('Link updated')
        } catch (err) {
            setError(errorMessage(err, 'Failed to update'))
        } finally {
            setSaving(false)
        }
    }

    if (authLoading || (user && !profile) || (loading && !config)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
                <main className="flex-1 space-y-6 max-w-3xl">
                    <div>
                        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
                            <Megaphone className="text-primary" /> Marketing Popup
                        </h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            The promo shown once per session to signed-out visitors landing on the site.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <AlertCircle size={16} className="shrink-0" /> {error}
                        </div>
                    )}

                    {savedMsg && (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                            <CheckCircle2 size={16} className="shrink-0" /> {savedMsg}
                        </div>
                    )}

                    {/* Enable / disable */}
                    <div className="glass-card p-6 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold mb-1">Popup Status</h3>
                            <p className="text-sm text-[var(--text-muted)]">
                                {config?.enabled
                                    ? "Live — signed-out visitors see this popup once per session."
                                    : "Disabled — the popup will not show to anyone."}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleEnabled}
                            disabled={saving}
                            role="switch"
                            aria-checked={!!config?.enabled}
                            aria-label="Toggle marketing popup"
                            className={`relative shrink-0 w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${config?.enabled ? "bg-emerald-500" : "bg-[var(--bg-input)] border border-[var(--border-default)]"}`}
                        >
                            <span
                                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${config?.enabled ? "translate-x-6" : "translate-x-0"}`}
                            />
                        </button>
                    </div>

                    {/* Image preview + upload */}
                    <div className="glass-card p-6 space-y-4">
                        <div>
                            <h3 className="font-bold mb-1">Promo Image</h3>
                            <p className="text-sm text-[var(--text-muted)]">
                                Shown inside the popup. Square-ish images work best (the popup caps width around 384px).
                            </p>
                        </div>

                        <div className="relative w-full max-w-xs mx-auto rounded-xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-input)]">
                            {config?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- unoptimized preview of an admin-supplied external URL, same reasoning as MarketingPopup.tsx
                                <img src={config.imageUrl} alt="Current marketing popup" className="w-full h-auto" />
                            ) : (
                                <Image
                                    src="/assets/images/promo-100-auction-popup.jpeg"
                                    alt="Default marketing popup"
                                    width={800}
                                    height={800}
                                    className="w-full h-auto"
                                    unoptimized
                                />
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        {!config?.imageUrl && (
                            <p className="text-xs text-[var(--text-faint)] text-center">Showing the built-in default — no custom image uploaded yet.</p>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelected}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || saving}
                            className="w-full sm:w-auto"
                        >
                            {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
                            {uploading ? 'Uploading…' : 'Upload New Image'}
                        </Button>
                    </div>

                    {/* Destination link */}
                    <div className="glass-card p-6 space-y-3">
                        <div>
                            <h3 className="font-bold mb-1">Destination Link</h3>
                            <p className="text-sm text-[var(--text-muted)]">Where clicking the popup image takes visitors.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={linkUrlDraft}
                                onChange={(e) => setLinkUrlDraft(e.target.value)}
                                placeholder="/auctions"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSaveLink}
                                disabled={saving || linkUrlDraft === config?.linkUrl}
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                        {config?.linkUrl && (
                            <a
                                href={config.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                                Preview destination <ExternalLink size={11} />
                            </a>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
