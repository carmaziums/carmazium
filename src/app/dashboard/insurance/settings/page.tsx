"use client"

import * as React from "react"
import { Settings, Loader2, Building2, Globe, Key, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

export default function InsuranceSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [saving, setSaving] = React.useState(false)
    const [companyName, setCompanyName] = React.useState("")
    const [callbackUrl, setCallbackUrl] = React.useState("")

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    const handleSave = async () => {
        setSaving(true)
        setTimeout(() => setSaving(false), 1000)
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="insurance" userName={userName} userType="Insurance Partner" />

                <main className="flex-1 space-y-8">
                    <h1 className="text-2xl font-black font-heading flex items-center gap-2">
                        <Settings className="text-primary" /> Partner Settings
                    </h1>

                    {/* Company Info */}
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
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Coverage Types Offered</label>
                            <div className="flex flex-wrap gap-2">
                                {["Comprehensive", "Third Party", "Third Party, Fire & Theft", "Temporary"].map(type => (
                                    <span key={type} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold">
                                        <Shield size={10} className="inline mr-1" /> {type}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Integration Settings */}
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
                            <p className="text-xs text-[var(--text-muted)] mt-2">We&apos;ll send quote status webhooks to this URL</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">API Key</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value="••••••••••••••••"
                                    disabled
                                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-[var(--text-muted)] cursor-not-allowed font-mono"
                                />
                                <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-muted)] hover:text-primary dark:hover:">
                                    <Key size={16} className="mr-2" /> Regenerate
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving} className="px-8">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                </main>
            </div>
        </div>
    )
}
