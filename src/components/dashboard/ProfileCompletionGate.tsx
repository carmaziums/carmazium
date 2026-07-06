"use client"

import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/lib/listingApi"
import { Loader2, User, Phone, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react"

/**
 * Blocks the dashboard until the user has a first/last name and (for
 * non-dealer roles) a phone number on file — both are shown on their public
 * profile and any listings they create. Dealers' contact phone lives on
 * DealerProfile instead and is enforced separately in the dealer layout,
 * after KYC approval (DealerProfile doesn't exist until then).
 */
export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, refreshProfile } = useAuth()
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [initialized, setInitialized] = React.useState(false)
    const [error, setError] = React.useState("")
    const [saving, setSaving] = React.useState(false)

    const isDealer = profile?.role === "DEALER"
    const needsName = !profile?.firstName || !profile?.lastName
    const needsPhone = !isDealer && !profile?.phone
    const shouldGate = !loading && !!user && !!profile && (needsName || needsPhone)

    // Prefill from whatever partial data already exists, once
    React.useEffect(() => {
        if (shouldGate && !initialized) {
            setFirstName(profile?.firstName || "")
            setLastName(profile?.lastName || "")
            setInitialized(true)
        }
    }, [shouldGate, initialized, profile])

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "var(--bg-body)" }}>
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
            </div>
        )
    }

    if (!shouldGate) {
        return <>{children}</>
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (needsName && (!firstName.trim() || !lastName.trim())) {
            setError("Please enter both your first and last name.")
            return
        }
        if (needsPhone && !phone.trim()) {
            setError("Please enter a phone number.")
            return
        }

        setSaving(true)
        try {
            await updateProfile({
                ...(needsName ? { firstName: firstName.trim(), lastName: lastName.trim() } : {}),
                ...(needsPhone ? { phone: phone.trim() } : {}),
            })
            await refreshProfile()
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
                        <ShieldCheck className="text-primary" size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black font-heading text-white tracking-tight uppercase">
                            Complete Your Profile
                        </h1>
                        <p className="text-[11px] text-gray-400">One quick step before you continue</p>
                    </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed mt-4 mb-6">
                    We now require a name{needsPhone ? " and phone number" : ""} on every account. This is shown on your
                    public profile and any listings you create — your phone number stays hidden from visitors who
                    aren't logged in.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {needsName && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <User size={11} /> First Name
                                </label>
                                <input
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    placeholder="John"
                                    autoFocus
                                    className="w-full h-11 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Last Name</label>
                                <input
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    placeholder="Doe"
                                    className="w-full h-11 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {needsPhone && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                <Phone size={11} /> Phone Number
                            </label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="07123 456789"
                                type="tel"
                                className="w-full h-11 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    )}

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
