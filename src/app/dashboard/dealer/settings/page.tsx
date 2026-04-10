"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Settings, Building2, MapPin, Phone, Globe, Clock,
    Loader2, Save, CheckCircle, Bell, CreditCard
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

export default function DealerSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState("profile")
    const [form, setForm] = React.useState({
        companyName: "",
        vatNumber: "",
        registrationNumber: "",
        businessAddress: "",
        phone: "",
        website: "",
        description: "",
    })

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchProfile()
        }
    }, [user, authLoading])

    async function fetchProfile() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any }>('/users/me')
            const d = res?.data?.dealerProfile
            if (d) {
                setForm(f => ({
                    ...f,
                    companyName: d.companyName ?? "",
                    vatNumber: d.vatNumber ?? "",
                    registrationNumber: d.registrationNumber ?? "",
                    businessAddress: d.businessAddress ?? "",
                    phone: d.phone ?? "",
                    website: d.website ?? "",
                    description: d.description ?? "",
                }))
            }
        } catch {
            // profile may not exist yet, use empty form
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            await apiClient('/users/dealer-profile', {
                method: 'PATCH',
                body: JSON.stringify({
                    companyName: form.companyName,
                    vatNumber: form.vatNumber,
                    registrationNumber: form.registrationNumber,
                    businessAddress: form.businessAddress,
                    phone: form.phone,
                    website: form.website,
                    description: form.description,
                }),
            })
        } catch (err) {
            console.error('Failed to save profile:', err)
        } finally {
            setSaving(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const tabs = [
        { key: "profile", label: "Dealership Profile", icon: Building2 },
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "payments", label: "Payouts", icon: CreditCard },
    ]

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div>
                        <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">Settings</h1>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Manage your dealership profile and preferences</p>
                    </div>

                    {/* Tab Selector */}
                    <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5 w-fit">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-primary text-white shadow-neon'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {activeTab === "profile" && (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8 space-y-6">
                                    {/* Logo Upload */}
                                    <div className="flex items-center gap-6 pb-6 border-b border-white/5">
                                        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/10 cursor-pointer hover:border-primary/50 transition-colors">
                                            <Building2 size={28} className="text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">Dealership Logo</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Click to upload • PNG, JPG up to 2MB</p>
                                        </div>
                                    </div>

                                    {/* Form Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-2">
                                                <Building2 size={12} /> Company Name
                                            </label>
                                            <Input
                                                value={form.companyName}
                                                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                                                placeholder="Your Dealership Ltd"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400">VAT Number</label>
                                            <Input
                                                value={form.vatNumber}
                                                onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value }))}
                                                placeholder="GB123456789"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Registration Number</label>
                                            <Input
                                                value={form.registrationNumber}
                                                onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))}
                                                placeholder="Company house number"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-2">
                                                <Phone size={12} /> Phone
                                            </label>
                                            <Input
                                                value={form.phone}
                                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                                placeholder="+44 20 1234 5678"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-2">
                                                <Globe size={12} /> Website
                                            </label>
                                            <Input
                                                value={form.website}
                                                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                                                placeholder="https://yourdealership.co.uk"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-2">
                                                <MapPin size={12} /> Business Address
                                            </label>
                                            <Input
                                                value={form.businessAddress}
                                                onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))}
                                                placeholder="123 High Street, London"
                                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Description / Tagline</label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                            rows={3}
                                            placeholder="Tell buyers about your dealership..."
                                            className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-600 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-white/5">
                                        <Button className="gap-2 h-10 shadow-neon" shape="default" onClick={handleSave} disabled={saving}>
                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                            {saving ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {activeTab === "notifications" && (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
                                    <h3 className="font-black uppercase tracking-tight mb-6">Notification Preferences</h3>
                                    <div className="space-y-4">
                                        {[
                                            { label: "New leads", desc: "When a buyer enquires about one of your vehicles" },
                                            { label: "New offers", desc: "When a buyer makes an offer on a listing" },
                                            { label: "Finance applications", desc: "When a buyer applies for finance" },
                                            { label: "Messages", desc: "New messages from buyers or team" },
                                        ].map(pref => (
                                            <div key={pref.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                                                <div>
                                                    <p className="font-bold text-white text-sm">{pref.label}</p>
                                                    <p className="text-xs text-gray-500">{pref.desc}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "payments" && (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
                                    <h3 className="font-black uppercase tracking-tight mb-4">Payout Method</h3>
                                    <div className="flex items-center justify-center py-12 text-center">
                                        <div>
                                            <CreditCard className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                            <p className="text-gray-500 font-bold">No payout method configured</p>
                                            <p className="text-gray-600 text-sm mt-1">Connect a bank account to receive payments</p>
                                            <Button className="mt-4 gap-2" shape="default">
                                                <CreditCard size={16} /> Connect Bank Account
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
