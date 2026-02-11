"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/lib/listingApi"
import { Loader2, Check, AlertCircle } from "lucide-react"

export default function ServiceProviderSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle")

    React.useEffect(() => {
        if (profile) {
            setFirstName(profile.firstName || "")
            setLastName(profile.lastName || "")
            setEmail(profile.email || user?.email || "")
            setPhone(profile.phone || "")
        } else if (user) {
            setEmail(user.email || "")
        }
    }, [profile, user])

    const initials = React.useMemo(() => {
        if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
        if (firstName) return firstName[0].toUpperCase()
        if (email) return email[0].toUpperCase()
        return "?"
    }, [firstName, lastName, email])

    const handleSave = async () => {
        try {
            setSaving(true)
            setSaveStatus("idle")
            await updateProfile({ firstName, lastName, phone })
            setSaveStatus("success")
            setTimeout(() => setSaveStatus("idle"), 3000)
        } catch (err) {
            console.error("Failed to save profile:", err)
            setSaveStatus("error")
        } finally {
            setSaving(false)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Service Provider"} />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Service Provider Settings</h1>

                    <div className="glass-card p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-1/3">
                                <div className="w-24 h-24 rounded-full bg-slate-800 mx-auto md:mx-0 flex items-center justify-center text-3xl font-bold text-primary mb-4 border-2 border-dashed border-primary/50 relative overflow-hidden group cursor-pointer hover:border-primary transition-colors shadow-neon">
                                    {initials}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">Logo</div>
                                </div>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Business Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">First Name</label>
                                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Last Name</label>
                                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Contact Email</label>
                                            <input type="email" value={email} readOnly className="w-full bg-slate-800/50 border border-white/10 rounded px-4 py-2 text-gray-400 cursor-not-allowed outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Phone</label>
                                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Service Preferences</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800" />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Accept new job requests</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800" />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Display business in public directory</span>
                                        </label>
                                    </div>
                                </section>

                                <div className="pt-4 flex items-center gap-4">
                                    <button onClick={handleSave} disabled={saving} className="bg-primary text-white font-bold py-3 px-8 rounded shadow-neon hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Business Details"}
                                    </button>
                                    {saveStatus === "success" && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check size={16} /> Saved successfully</span>}
                                    {saveStatus === "error" && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={16} /> Failed to save</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
