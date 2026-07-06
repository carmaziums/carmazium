"use client"

import React from "react"
import { useAuth } from "@/context/AuthContext"
import { KycOverlayForm, KYC_SKIP_KEY } from "@/components/dashboard/KycOverlayForm"
import { Loader2, Lock, ShieldCheck, ArrowRight, Phone, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/apiClient"

/**
 * Blocks the dealer dashboard until the dealership's contact phone is set.
 * DealerProfile doesn't exist until KYC is submitted, so this must run
 * after `isVerifiedDealer` — not in the root ProfileCompletionGate.
 */
function DealerPhoneGate({ onSaved }: { onSaved: () => void }) {
    const [phone, setPhone] = React.useState("")
    const [error, setError] = React.useState("")
    const [saving, setSaving] = React.useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        if (!phone.trim()) {
            setError("Please enter a contact phone number.")
            return
        }
        setSaving(true)
        try {
            await apiClient('/users/dealer-profile', {
                method: 'PATCH',
                body: JSON.stringify({ phone: phone.trim() }),
            })
            onSaved()
        } catch (err: any) {
            setError(err.message || "Failed to save. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ background: "rgba(2, 6, 23, 0.95)" }}>
            <div className="w-full max-w-md rounded-2xl border border-white/5 p-8" style={{ background: "var(--bg-card)" }}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Phone className="text-primary" size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black font-heading text-white tracking-tight uppercase">
                            Add a Contact Number
                        </h1>
                        <p className="text-[11px] text-gray-400">Shown to buyers on your listings</p>
                    </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed mt-4 mb-6">
                    A dealership contact phone is now required. It appears on your listings and public dealer profile —
                    hidden from visitors who aren't logged in.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="01234 567890"
                        type="tel"
                        autoFocus
                        className="w-full h-11 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
                    />

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <>Continue <ArrowRight size={15} /></>}
                    </button>
                </form>
            </div>
        </div>
    )
}

/**
 * Dealer Dashboard Layout
 * Wraps all /dashboard/dealer/* pages and blocks access if unverified.
 * Unverified dealers can "Skip for now" — they get a limited-mode banner
 * and can change their account type from the Settings page.
 */
export default function DealerDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()
    const [skipped, setSkipped] = React.useState(false)
    const [switchingRole, setSwitchingRole] = React.useState(false)

    const handleSwitchToBuyer = async () => {
        setSwitchingRole(true)
        try {
            await apiClient('/users/elevate', {
                method: 'POST',
                body: JSON.stringify({ newRole: 'BUYER' }),
            })
            if (typeof window !== 'undefined') {
                localStorage.removeItem(KYC_SKIP_KEY)
            }
            await refreshProfile()
            router.push('/dashboard')
        } catch (err: any) {
            console.error('Failed to switch role:', err)
        } finally {
            setSwitchingRole(false)
        }
    }

    // Read skip flag client-side after hydration
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            setSkipped(localStorage.getItem(KYC_SKIP_KEY) === '1')
        }
    }, [])

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'var(--bg-body)' }}>
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <p className="text-sm tracking-wider uppercase text-[var(--text-muted)] font-semibold font-heading">
                    Synchronizing Dealer Portal...
                </p>
            </div>
        )
    }

    const isEmailVerified = !!user?.email_confirmed_at
    const isStaffMember = !!((profile as any)?.dealerStaffMemberships?.length)
    const isVerifiedDealer = !!profile?.dealerProfile?.isVerified || isStaffMember

    // Show KYC overlay unless: verified, staff member, or user explicitly skipped
    if (isEmailVerified && !isVerifiedDealer && !skipped) {
        return <KycOverlayForm onSkip={() => setSkipped(true)} />
    }

    // Show locked dashboard when user skipped — dealer features require KYC
    if (skipped && !isVerifiedDealer) {
        const startKyc = () => {
            if (typeof window !== 'undefined') localStorage.removeItem(KYC_SKIP_KEY)
            setSkipped(false)
            router.push('/dashboard/dealer')
        }
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-20 text-center">
                {/* Lock icon */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                        <Lock size={40} className="text-amber-400" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-950 border border-[var(--border-default)] flex items-center justify-center">
                        <ShieldCheck size={16} className="text-[var(--text-muted)]" />
                    </div>
                </div>

                <h1 className="text-3xl font-black font-heading text-white mb-3 tracking-tight">
                    Dealer Features Locked
                </h1>
                <p className="text-[var(--text-muted)] max-w-md mb-2 leading-relaxed">
                    Complete KYC verification to unlock your dealer dashboard and start listing vehicles, managing inventory, and accessing auction tools.
                </p>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-10">
                    Verification typically takes less than 24 hours
                </p>

                {/* Feature list */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 max-w-lg w-full">
                    {[
                        "List Vehicles",
                        "Manage Inventory",
                        "Run Auctions",
                        "Bulk Import",
                        "Analytics",
                        "Offer Management",
                    ].map(f => (
                        <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] opacity-50">
                            <Lock size={12} className="text-amber-400 shrink-0" />
                            <span className="text-xs text-[var(--text-muted)] font-semibold">{f}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={startKyc}
                    className="flex items-center gap-2 px-10 py-4 bg-primary hover:bg-red-600 text-white font-bold rounded-2xl text-lg shadow-[0_4px_20px_rgba(237,28,36,0.4)] transition-all hover:scale-105 active:scale-95"
                >
                    Start KYC Verification <ArrowRight size={20} />
                </button>

                <p className="text-xs text-[var(--text-secondary)] mt-6">
                    Changed your mind?{' '}
                    <button
                        onClick={handleSwitchToBuyer}
                        disabled={switchingRole}
                        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline transition-colors disabled:opacity-50"
                    >
                        {switchingRole ? 'Switching...' : 'Go to buyer dashboard'}
                    </button>
                </p>
            </div>
        )
    }

    // Require a dealership contact phone once KYC is verified — skip for
    // staff members, who don't own the dealer profile.
    if (isVerifiedDealer && !isStaffMember && !profile?.dealerProfile?.phone) {
        return <DealerPhoneGate onSaved={refreshProfile} />
    }

    return <>{children}</>
}
