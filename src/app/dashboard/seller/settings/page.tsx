"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { updateProfile, startStripeConnectOnboarding, getStripeConnectStatus, type StripeConnectStatus } from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"
import { Loader2, Check, AlertCircle, Camera, BadgeCheck, CreditCard, ExternalLink, AlertTriangle } from "lucide-react"

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
            const publicUrl = await uploadImage(file, 'carmazium-images')
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
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Seller"} />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Seller Settings</h1>

                    <div className="glass-card p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-1/3">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-32 h-32 rounded-full bg-slate-800 mx-auto md:mx-0 flex items-center justify-center text-4xl font-bold text-gray-500 mb-4 border-2 border-dashed border-gray-600 relative overflow-hidden group cursor-pointer hover:border-primary transition-colors"
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
                                <p className="text-center md:text-left text-xs text-gray-500 mt-2">Recommended: 256x256px JPG or PNG</p>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Profile Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">First Name</label>
                                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Last Name</label>
                                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm text-gray-400">Email Address</label>
                                            <input type="email" value={email} readOnly className="w-full bg-slate-800/50 border border-white/10 rounded px-4 py-2 text-gray-400 cursor-not-allowed outline-none" />
                                            <p className="text-xs text-gray-500">Email is managed through your authentication provider</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Seller Preferences</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={notifyOnSale}
                                                onChange={e => setNotifyOnSale(e.target.checked)}
                                                className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800"
                                            />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Email me when a listing is sold</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={showPublicProfile}
                                                onChange={e => setShowPublicProfile(e.target.checked)}
                                                className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800"
                                            />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Show my profile publicly</span>
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
                    <div className="glass-card p-8 border border-white/5 bg-white/5 rounded-2xl">
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <CreditCard className="text-primary" size={20} /> Payouts
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Connect a bank account to receive your £100 seller bonus after a successful auction handover is verified.
                        </p>

                        {connectStatus?.onboardingComplete ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <BadgeCheck size={20} className="text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-300">Bank account connected</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Payouts are enabled. Your bonuses will transfer automatically after handover approval.</p>
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
                                <p className="text-xs text-gray-500">You will be taken to Stripe's secure onboarding — this takes about 2 minutes.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
