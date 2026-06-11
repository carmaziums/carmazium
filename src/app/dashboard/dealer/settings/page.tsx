"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Settings, Building2, MapPin, Phone, Globe,
    Loader2, Save, Bell, UserCog, AlertTriangle
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { uploadImage } from "@/lib/supabase"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { KYC_SKIP_KEY } from "@/components/dashboard/KycOverlayForm"
import { useRouter } from "next/navigation"

export default function DealerSettingsPage() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [switchingRole, setSwitchingRole] = React.useState(false)
    const [roleError, setRoleError] = React.useState("")
    const [activeTab, setActiveTab] = React.useState("profile")
    const [form, setForm] = React.useState({
        companyName: "",
        vatNumber: "",
        registrationNumber: "",
        businessAddress: "",
        phone: "",
        website: "",
        description: "",
        logo: "",
    })
    const [uploadingLogo, setUploadingLogo] = React.useState(false)

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
            const kyc = d?.kyc
            if (d) {
                setForm(f => ({
                    ...f,
                    // Prefer DealerProfile value; fall back to matching KYC field for
                    // dealers who submitted KYC before the auto-sync was added
                    companyName: d.companyName && !d.companyName.startsWith('PENDING-') ? d.companyName : (kyc?.companyHouseName ?? d.companyName ?? ""),
                    vatNumber: d.vatNumber && !d.vatNumber.startsWith('PENDING-') ? d.vatNumber : (kyc?.vatNumber ?? ""),
                    registrationNumber: d.registrationNumber || kyc?.companyRegistrationNumber || "",
                    businessAddress: d.businessAddress || kyc?.businessRegisteredAddress || "",
                    phone: d.phone ?? "",
                    website: d.website || kyc?.businessWebsite || "",
                    description: d.description ?? "",
                    logo: d.logo ?? "",
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
                    logo: form.logo,
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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            alert("File size must be less than 2MB")
            return
        }

        setUploadingLogo(true)
        try {
            const url = await uploadImage(file, 'listings')
            setForm(f => ({ ...f, logo: url }))
        } catch (err: any) {
            console.error("Failed to upload logo:", err)
            alert("Failed to upload logo. Please try again.")
        } finally {
            setUploadingLogo(false)
        }
    }

    async function handleSwitchRole(newRole: 'BUYER' | 'SELLER') {
        setSwitchingRole(true)
        setRoleError("")
        try {
            await apiClient('/users/elevate', {
                method: 'POST',
                body: JSON.stringify({ newRole }),
            })
            await refreshProfile()
            if (typeof window !== 'undefined') {
                localStorage.removeItem(KYC_SKIP_KEY)
            }
            router.push('/dashboard')
        } catch (err: any) {
            setRoleError(err.message || 'Failed to switch account type. Please try again.')
        } finally {
            setSwitchingRole(false)
        }
    }

    const tabs = [
        { key: "profile", label: "Dealership Profile", icon: Building2 },
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "account", label: "Account Type", icon: UserCog },
    ]

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title={DEALER_ROUTE_CONFIG[10].title}
                        subHeader={DEALER_ROUTE_CONFIG[10].subHeader}
                    />

                    {/* Tab Selector */}
                    <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5 w-full max-w-full overflow-x-auto hide-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
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
                                        <label className="relative block">
                                            <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} disabled={uploadingLogo} />
                                            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/10 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden group">
                                                {uploadingLogo ? (
                                                    <Loader2 size={24} className="text-primary animate-spin" />
                                                ) : form.logo ? (
                                                    <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 size={28} className="text-gray-600 group-hover:text-primary transition-colors" />
                                                )}
                                            </div>
                                        </label>
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

                            {activeTab === "account" && (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8 space-y-6">
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-300 mb-1">Change Account Type</p>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                Switching your account type will remove your dealer profile and move you to the standard buyer/seller dashboard.
                                                This action cannot be undone without re-registering as a dealer.
                                            </p>
                                        </div>
                                    </div>

                                    {roleError && (
                                        <p className="text-xs text-red-400 font-semibold">{roleError}</p>
                                    )}

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {(['BUYER', 'SELLER'] as const).map(role => (
                                            <button
                                                key={role}
                                                onClick={() => handleSwitchRole(role)}
                                                disabled={switchingRole}
                                                className="flex flex-col items-start gap-2 p-5 rounded-xl border border-white/10 bg-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                                            >
                                                <p className="text-sm font-black text-white uppercase tracking-wide">
                                                    {switchingRole ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                                                    Become a {role.charAt(0) + role.slice(1).toLowerCase()}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {role === 'BUYER'
                                                        ? 'Browse and purchase vehicles. No listing permissions.'
                                                        : 'List and sell vehicles without dealer features.'}
                                                </p>
                                            </button>
                                        ))}
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
