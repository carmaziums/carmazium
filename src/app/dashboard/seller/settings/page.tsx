"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { updateProfile, startStripeConnectOnboarding, getStripeConnectStatus, updateBankDetails, type StripeConnectStatus } from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"
import { Loader2, Check, AlertCircle, Camera, BadgeCheck, CreditCard, ExternalLink, AlertTriangle, Landmark } from "lucide-react"

export default function SellerSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [profileImage, setProfileImage] = React.useState("")
    const [notifyOnSale, setNotifyOnSale] = React.useState(true)
    const [showPublicProfile, setShowPublicProfile] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [uploadingImage, setUploadingImage] = React.useState(false)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle")
    const [connectStatus, setConnectStatus] = React.useState<StripeConnectStatus | null>(null)
    const [connectLoading, setConnectLoading] = React.useState(false)
    const [connectError, setConnectError] = React.useState("")
    const [bankName, setBankName] = React.useState("")
    const [bankSortCode, setBankSortCode] = React.useState("")
    const [bankAccountNumber, setBankAccountNumber] = React.useState("")
    const [savingBank, setSavingBank] = React.useState(false)
    const [bankSaveStatus, setBankSaveStatus] = React.useState<"idle" | "success" | "error">("idle")
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        getStripeConnectStatus().then(setConnectStatus).catch(() => {})
    }, [])

    // When Stripe redirects back, re-fetch status and clean the URL
    React.useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        if (params.get('stripe_connect')) {
            getStripeConnectStatus().then(setConnectStatus).catch(() => {})
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    React.useEffect(() => {
        if (profile) {
            setFirstName(profile.firstName || "")
            setLastName(profile.lastName || "")
            setEmail(profile.email || user?.email || "")
            setProfileImage(profile.profileImage || "")
            if (typeof (profile as any).notifyOnSale === 'boolean') setNotifyOnSale((profile as any).notifyOnSale)
            if (typeof (profile as any).showPublicProfile === 'boolean') setShowPublicProfile((profile as any).showPublicProfile)
            setBankName((profile as any).bankAccountName || "")
            setBankSortCode((profile as any).bankSortCode || "")
            setBankAccountNumber((profile as any).bankAccountNumber || "")
        } else if (user) {
            setEmail(user.email || "")
            setProfileImage("")
        }
    }, [profile, user])

    const initials = React.useMemo(() => {
        if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
        if (firstName) return firstName[0].toUpperCase()
        if (email) return email[0].toUpperCase()
        return "?"
    }, [firstName, lastName, email])

    const handleConnectStripe = async () => {
        setConnectLoading(true)
        setConnectError("")
        try {
            const origin = window.location.origin
            const { url } = await startStripeConnectOnboarding(
                `${origin}/dashboard/seller/settings?stripe_connect=return`,
                `${origin}/dashboard/seller/settings?stripe_connect=refresh`,
            )
            window.location.href = url
        } catch (err: any) {
            setConnectError(err.message || "Failed to start Stripe Connect onboarding.")
        } finally {
            setConnectLoading(false)
        }
    }

    const handleSaveBank = async () => {
        try {
            setSavingBank(true)
            setBankSaveStatus("idle")
            await updateBankDetails({ bankAccountName: bankName, bankSortCode, bankAccountNumber })
            setBankSaveStatus("success")
            setTimeout(() => setBankSaveStatus("idle"), 3000)
        } catch {
            setBankSaveStatus("error")
        } finally {
            setSavingBank(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            setSaveStatus("idle")
            await updateProfile({ firstName, lastName, profileImage, notifyOnSale, showPublicProfile })
            setSaveStatus("success")
            setTimeout(() => setSaveStatus("idle"), 3000)
        } catch (err) {
            console.error("Failed to save profile:", err)
            setSaveStatus("error")
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]
        try {
            setUploadingImage(true)
            const publicUrl = await uploadImage(file, 'listings', 'profiles')
            setProfileImage(publicUrl)
            // Auto-save immediately after upload
            await updateProfile({ profileImage: publicUrl })
        } catch (err) {
            console.error("Failed to upload image:", err)
            alert("Failed to upload image. Please try again.")
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Seller"} />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading mb-6">Seller Settings</h1>

                    <div className="glass-card p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-1/3">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-32 h-32 rounded-full bg-[var(--bg-input)] mx-auto md:mx-0 flex items-center justify-center text-4xl font-bold text-[var(--text-muted)] mb-4 border-2 border-dashed border-[var(--border-default)] relative overflow-hidden group cursor-pointer hover:border-primary transition-colors"
                                >
                                    {uploadingImage ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    ) : profileImage ? (
                                        <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        initials
                                    )}
                                    {!uploadingImage && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">
                                            <Camera size={20} className="mb-1" />
                                            <span>Upload</span>
                                        </div>
                                    )}
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleImageUpload} 
                                />
                                <p className="text-center md:text-left text-xs text-[var(--text-muted)] mt-2">Recommended: 256x256px JPG or PNG</p>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <section>
                                    <h3 className="text-xl font-bold mb-4 border-b border-[var(--border-default)] pb-2">Profile Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm text-[var(--text-muted)]">First Name</label>
                                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-[var(--text-muted)]">Last Name</label>
                                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm text-[var(--text-muted)]">Email Address</label>
                                            <input type="email" value={email} readOnly className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 text-[var(--text-muted)] cursor-not-allowed outline-none" />
                                            <p className="text-xs text-[var(--text-muted)]">Email is managed through your authentication provider</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold mb-4 border-b border-[var(--border-default)] pb-2">Seller Preferences</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={notifyOnSale}
                                                onChange={e => setNotifyOnSale(e.target.checked)}
                                                className="w-5 h-5 rounded border-[var(--border-default)] text-primary focus:ring-primary bg-[var(--bg-input)]"
                                            />
                                            <span className="text-[var(--text-secondary)] group-hover:text-primary dark:group-hover:text-white transition-colors">Email me when a listing is sold</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={showPublicProfile}
                                                onChange={e => setShowPublicProfile(e.target.checked)}
                                                className="w-5 h-5 rounded border-[var(--border-default)] text-primary focus:ring-primary bg-[var(--bg-input)]"
                                            />
                                            <span className="text-[var(--text-secondary)] group-hover:text-primary dark:group-hover:text-white transition-colors">Show my profile publicly</span>
                                        </label>
                                    </div>
                                </section>

                                <div className="pt-4 flex items-center gap-4">
                                    <button onClick={handleSave} disabled={saving} className="bg-primary text-white font-bold py-3 px-8 rounded shadow-neon hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
                                    </button>
                                    {saveStatus === "success" && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check size={16} /> Saved successfully</span>}
                                    {saveStatus === "error" && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={16} /> Failed to save</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payouts */}
                    <div className="glass-card p-8 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <CreditCard className="text-primary" size={20} /> Payouts
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mb-6">
                            Connect a bank account to receive your £100 seller bonus after a successful auction handover is verified.
                        </p>

                        {connectStatus?.onboardingComplete ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <BadgeCheck size={20} className="text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-300">Bank account connected</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Payouts are enabled. Your bonuses will transfer automatically after handover approval.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {connectStatus?.connected && !connectStatus?.onboardingComplete && (
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-300">Your Stripe account was started but onboarding is incomplete. Click below to finish.</p>
                                    </div>
                                )}
                                {connectError && (
                                    <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={13} /> {connectError}</p>
                                )}
                                <button
                                    onClick={handleConnectStripe}
                                    disabled={connectLoading}
                                    className="flex items-center gap-2 bg-primary text-white font-bold py-3 px-6 rounded shadow-neon hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {connectLoading
                                        ? <><Loader2 size={16} className="animate-spin" /> Redirecting...</>
                                        : <><ExternalLink size={16} /> Connect Bank Account</>
                                    }
                                </button>
                                <p className="text-xs text-[var(--text-muted)]">You will be taken to Stripe's secure onboarding — this takes about 2 minutes.</p>
                            </div>
                        )}
                    </div>

                    {/* Bank Account Details (manual payout fallback — always visible) */}
                    <div className="glass-card p-8 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <Landmark className="text-amber-400" size={20} /> Bank Account Details
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mb-6">
                            Provide your UK bank details as a fallback. Carmazium can manually transfer your £100 bonus if Stripe Connect isn&apos;t available.
                        </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-sm text-[var(--text-muted)]">Account Holder Name</label>
                                    <input
                                        type="text"
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                        placeholder="e.g. John Smith"
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 focus:border-amber-400 outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-[var(--text-muted)]">Sort Code</label>
                                    <input
                                        type="text"
                                        value={bankSortCode}
                                        onChange={e => setBankSortCode(e.target.value)}
                                        placeholder="e.g. 00-00-00"
                                        maxLength={8}
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 focus:border-amber-400 outline-none transition-colors font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-[var(--text-muted)]">Account Number</label>
                                    <input
                                        type="text"
                                        value={bankAccountNumber}
                                        onChange={e => setBankAccountNumber(e.target.value)}
                                        placeholder="e.g. 12345678"
                                        maxLength={8}
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-4 py-2 focus:border-amber-400 outline-none transition-colors font-mono"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-4">
                                <button
                                    onClick={handleSaveBank}
                                    disabled={savingBank || !bankName || !bankSortCode || !bankAccountNumber}
                                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 px-6 rounded transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {savingBank ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save Bank Details"}
                                </button>
                                {bankSaveStatus === "success" && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                                {bankSaveStatus === "error" && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> Failed to save</span>}
                            </div>
                        </div>
                </main>
            </div>
        </div>
    )
}
