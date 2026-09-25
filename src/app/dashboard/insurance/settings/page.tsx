"use client"

import * as React from "react"
import { AlertCircle, Building2, CheckCircle2, Copy, Globe, Key, Loader2, Save, Settings, Shield } from "lucide-react"
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getInsurancePartnerSettings,
    regenerateInsurancePartnerKey,
    saveInsurancePartnerSettings,
    type PartnerSettings,
} from "@/lib/partnerApi"

export default function InsuranceSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [regenerating, setRegenerating] = React.useState(false)
    const [settings, setSettings] = React.useState<PartnerSettings | null>(null)
    const [companyName, setCompanyName] = React.useState("")
    const [callbackUrl, setCallbackUrl] = React.useState("")
    const [revealedKey, setRevealedKey] = React.useState("")
    const [copied, setCopied] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (authLoading || !user) return
        setLoading(true)
        setError(null)
        getInsurancePartnerSettings()
            .then((data) => {
                setSettings(data)
                setCompanyName(data.companyName)
                setCallbackUrl(data.callbackUrl)
            })
            .catch((err) => setError(err?.message || "Could not load insurance partner settings."))
            .finally(() => setLoading(false))
    }, [authLoading, user])

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : (user?.email?.split("@")[0] || "User")

    const handleSave = async () => {
        const trimmedName = companyName.trim()
        if (trimmedName.length < 2) {
            setError("Enter your insurance company or trading name.")
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const saved = await saveInsurancePartnerSettings({
                companyName: trimmedName,
                callbackUrl: callbackUrl.trim() || null,
            })
            setSettings(saved)
            setCompanyName(saved.companyName)
            setCallbackUrl(saved.callbackUrl)
            setSuccess("Insurance partner settings saved.")
        } catch (err: any) {
            setError(err?.message || "Could not save insurance partner settings.")
        } finally {
            setSaving(false)
        }
    }

    const handleRegenerate = async () => {
        if (!settings?.isConfigured) {
            setError("Save your company settings before generating an integration key.")
            return
        }
        if (!window.confirm("Generate a new integration key? Any previously issued key will stop working.")) return

        setRegenerating(true)
        setError(null)
        setSuccess(null)
        setCopied(false)
        try {
            const result = await regenerateInsurancePartnerKey()
            setRevealedKey(result.apiKey)
            setSettings(current => current ? { ...current, apiKeyHint: result.apiKeyHint } : current)
            setSuccess("New integration key generated. Copy it now; the full key will not be shown again after you leave this page.")
        } catch (err: any) {
            setError(err?.message || "Could not regenerate the integration key.")
        } finally {
            setRegenerating(false)
        }
    }

    const copyKey = async () => {
        if (!revealedKey) return
        await navigator.clipboard.writeText(revealedKey)
        setCopied(true)
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="insurance" userName={userName} userType="Insurance Partner" />

                <main className="flex-1 space-y-8">
                    <h1 className="text-2xl font-black font-heading flex items-center gap-2">
                        <Settings className="text-primary" /> Partner Settings
                    </h1>

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex gap-2">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex gap-2">
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> {success}
                        </div>
                    )}

                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl p-6 space-y-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Building2 size={18} className="text-primary" /> Company Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Your insurance company name"
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Contact Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ""}
                                    disabled
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-[var(--text-muted)] cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Coverage Types</label>
                            <div className="flex flex-wrap gap-2">
                                {["Comprehensive", "Third Party", "Third Party, Fire & Theft", "Temporary"].map(type => (
                                    <span key={type} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold">
                                        <Shield size={10} className="inline mr-1" /> {type}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                Coverage type is selected when you issue each quote; these are supported quote labels, not account-level eligibility settings.
                            </p>
                        </div>
                    </div>

                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl p-6 space-y-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Globe size={18} className="text-primary" /> Integration Settings
                        </h2>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Callback URL</label>
                            <input
                                type="url"
                                value={callbackUrl}
                                onChange={(e) => setCallbackUrl(e.target.value)}
                                placeholder="https://your-api.example.com/webhook"
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                Saved for approved external integrations. Automatic callback delivery is not enabled until CarMazium activates the integration.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Integration Key</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={revealedKey || settings?.apiKeyHint || "No key generated"}
                                    readOnly
                                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-[var(--text-muted)] font-mono"
                                />
                                {revealedKey && (
                                    <Button type="button" variant="outline" onClick={copyKey}>
                                        <Copy size={16} className="mr-2" /> {copied ? "Copied" : "Copy"}
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleRegenerate}
                                    disabled={regenerating || !settings?.isConfigured}
                                >
                                    {regenerating ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Key size={16} className="mr-2" />}
                                    Regenerate
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                Keys are only exposed when regenerated. External API access is not enabled until a CarMazium partner integration is activated.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving} className="px-8">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                            Save Changes
                        </Button>
                    </div>

                    <DeleteAccountSection />
                </main>
            </div>
        </div>
    )
}
