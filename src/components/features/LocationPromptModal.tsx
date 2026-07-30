"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { MapPin, Hash, X, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/lib/listingApi"

const DISMISSED_KEY = "carmazium_location_prompt_dismissed"

// Pages where prompting for location would be redundant or intrusive —
// the onboarding wizard already collects it for fresh signups, and auth
// pages shouldn't show dashboard-style modals over them.
const EXCLUDED_PATH_PREFIXES = ["/auth/"]

/**
 * Existing accounts created before location/postcode were required fields
 * never went through the onboarding wizard's location step, so they'd
 * otherwise have no way to be asked for it. Shown once per browser session
 * (dismissible) until both fields are actually filled in.
 */
export function LocationPromptModal() {
    const { user, profile, loading, refreshProfile } = useAuth()
    const pathname = usePathname()
    const [dismissed, setDismissed] = React.useState(true)
    const [location, setLocation] = React.useState("")
    const [postcode, setPostcode] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (typeof window === "undefined") return
        setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "true")
    }, [])

    const isExcludedPath = EXCLUDED_PATH_PREFIXES.some((p) => pathname?.startsWith(p))
    const missingInfo = !!user && !!profile && (!profile.location?.trim() || !profile.postcode?.trim())
    const show = !loading && missingInfo && !dismissed && !isExcludedPath

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, "true")
        setDismissed(true)
    }

    const handleSave = async () => {
        const trimmedLocation = location.trim()
        const trimmedPostcode = postcode.trim()
        if (!trimmedLocation || !trimmedPostcode) {
            setError("Please fill in both fields.")
            return
        }
        setError("")
        setSaving(true)
        try {
            await updateProfile({ location: trimmedLocation, postcode: trimmedPostcode })
            await refreshProfile()
            handleDismiss()
        } catch (err: any) {
            setError(err.message || "Failed to save. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    if (!show) return null

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-5">
            <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 shadow-2xl">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={18} />
                </button>

                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <MapPin className="text-primary" size={20} />
                </div>
                <h2 className="text-lg font-black text-[var(--text-primary)]">Add your location</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1 mb-5">
                    We need your location and postal code to show you nearby listings and help buyers/sellers find you.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5">
                            <MapPin size={11} /> City / Location
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. London"
                            className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5">
                            <Hash size={11} /> Postal Code
                        </label>
                        <input
                            type="text"
                            value={postcode}
                            onChange={(e) => setPostcode(e.target.value)}
                            placeholder="e.g. E1 6AN"
                            className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors"
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        onClick={handleDismiss}
                        className="flex-1 h-11 rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] text-sm font-bold hover:text-[var(--text-primary)] transition-colors"
                    >
                        Later
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 h-11 rounded-xl bg-primary hover:bg-red-600 text-white text-sm font-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : "Save"}
                    </button>
                </div>
            </div>
        </div>
    )
}
