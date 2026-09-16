"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Mail, MapPin, Phone, RefreshCw, ShieldCheck, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/lib/listingApi"

const ONBOARDING_DRAFT_KEY = "carmazium_onboarding_draft"

export default function OnboardingPage() {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()

    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [phone, setPhone] = useState("")
    const [location, setLocation] = useState("")
    const [postcode, setPostcode] = useState("")
    const [initialized, setInitialized] = useState(false)
    const [pendingEmail, setPendingEmail] = useState<string | null>(null)
    const [pendingLoaded, setPendingLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const [resending, setResending] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const isVerified = Boolean(user?.email_confirmed_at)
    const accountEmail = user?.email || pendingEmail || ""

    useEffect(() => {
        if (typeof window === "undefined") return

        setPendingEmail(sessionStorage.getItem("pending_verification_email"))

        try {
            const draft = JSON.parse(sessionStorage.getItem(ONBOARDING_DRAFT_KEY) || "{}")
            setFirstName(typeof draft.firstName === "string" ? draft.firstName : "")
            setLastName(typeof draft.lastName === "string" ? draft.lastName : "")
            setPhone(typeof draft.phone === "string" ? draft.phone : "")
            setLocation(typeof draft.location === "string" ? draft.location : "")
            setPostcode(typeof draft.postcode === "string" ? draft.postcode : "")
        } catch {
            sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
        }

        setPendingLoaded(true)
    }, [])

    useEffect(() => {
        if (!pendingLoaded || loading || initialized || !user) return

        setFirstName(current => current || profile?.firstName || user.user_metadata?.first_name || user.user_metadata?.firstName || "")
        setLastName(current => current || profile?.lastName || user.user_metadata?.last_name || user.user_metadata?.lastName || "")
        setPhone(current => current || profile?.phone || "")
        setLocation(current => current || profile?.location || "")
        setPostcode(current => current || profile?.postcode || "")
        setInitialized(true)
    }, [pendingLoaded, loading, initialized, user, profile])

    useEffect(() => {
        if (!pendingLoaded || typeof window === "undefined") return
        sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
            firstName,
            lastName,
            phone,
            location,
            postcode,
        }))
    }, [pendingLoaded, firstName, lastName, phone, location, postcode])

    useEffect(() => {
        if (!pendingLoaded || loading) return
        if (!user && !pendingEmail) {
            router.replace("/auth/login")
        }
    }, [pendingLoaded, loading, user, pendingEmail, router])

    useEffect(() => () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current)
    }, [])

    const getBaseUrl = () => {
        if (typeof window !== "undefined") return window.location.origin
        return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }

    const startCooldown = (seconds = 60) => {
        setResendCooldown(seconds)
        if (cooldownRef.current) clearInterval(cooldownRef.current)
        cooldownRef.current = setInterval(() => {
            setResendCooldown(previous => {
                if (previous <= 1) {
                    if (cooldownRef.current) clearInterval(cooldownRef.current)
                    return 0
                }
                return previous - 1
            })
        }, 1000)
    }

    const handleResendEmail = async () => {
        const emailToUse = user?.email || pendingEmail
        if (!emailToUse || resendCooldown > 0) return

        setResending(true)
        setResendSuccess(false)
        setError("")

        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev").replace(/\/$/, "")
            const response = await fetch(`${apiBase}/auth/send-verification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailToUse,
                    redirectTo: `${getBaseUrl()}/auth/callback?redirect_to=/auth/onboarding`,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data?.message || response.statusText || "Failed to resend verification email.")
            }

            setResendSuccess(true)
            startCooldown(60)
            setTimeout(() => setResendSuccess(false), 6000)
        } catch (err: any) {
            setError(err?.message || "Failed to resend verification email. Please try again.")
        } finally {
            setResending(false)
        }
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError("")

        if (!user || !isVerified) {
            setError("Please verify your email before completing your account.")
            return
        }

        const trimmedFirstName = firstName.trim()
        const trimmedLastName = lastName.trim()
        const trimmedPhone = phone.trim()
        const trimmedLocation = location.trim()
        const trimmedPostcode = postcode.trim()

        if (!trimmedFirstName || !trimmedLastName || !trimmedPhone || !trimmedLocation || !trimmedPostcode) {
            setError("Please complete every required field before continuing.")
            return
        }

        setSaving(true)
        try {
            await updateProfile({
                firstName: trimmedFirstName,
                lastName: trimmedLastName,
                phone: trimmedPhone,
                location: trimmedLocation,
                postcode: trimmedPostcode,
            })

            if (typeof window !== "undefined") {
                localStorage.setItem("carmazium_user_location", trimmedLocation)
                sessionStorage.removeItem("pending_verification_email")
                sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
            }

            await refreshProfile()
            router.replace("/auth/registration-complete")
        } catch (err: any) {
            setError(err?.message || "Failed to complete your account. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    if (loading && user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="animate-spin text-primary h-12 w-12" />
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-slate-900 pt-24 pb-12 px-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[url('/assets/images/hero-bg.png')] bg-cover opacity-20" />

            <div className="relative z-10 mx-auto w-full max-w-2xl">
                <div className="mb-7 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black font-heading text-white tracking-tight">Complete Your Account</h1>
                    <p className="mt-2 text-sm text-gray-400">
                        One short form with the essential details we need to keep CarMazium accounts complete and genuine.
                    </p>
                </div>

                <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 sm:p-8">
                    {!isVerified && (
                        <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
                            <div className="flex items-start gap-3">
                                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="font-bold text-white">Verify your email</h2>
                                    <p className="mt-1 text-sm leading-relaxed text-gray-300">
                                        We sent a verification link to <span className="font-semibold text-white">{accountEmail || "your email address"}</span>. You can fill this form now, but email verification is required before it can be submitted.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="mt-3 gap-2 border-white/15 text-white hover:bg-white/5"
                                        onClick={handleResendEmail}
                                        disabled={resending || resendCooldown > 0 || !accountEmail}
                                    >
                                        {resending ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                                        ) : resendCooldown > 0 ? (
                                            <><RefreshCw className="h-4 w-4" /> Resend in {resendCooldown}s</>
                                        ) : (
                                            <><RefreshCw className="h-4 w-4" /> Resend Verification Email</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isVerified && (
                        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Email verified. Complete the required details below to continue.
                        </div>
                    )}

                    {resendSuccess && (
                        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Verification email sent. Check your inbox and spam folder.
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="firstName" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-300">
                                    <UserIcon className="h-3.5 w-3.5" /> First Name
                                </label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    autoComplete="given-name"
                                    required
                                    value={firstName}
                                    onChange={event => setFirstName(event.target.value)}
                                    placeholder="John"
                                    className="bg-slate-900/60 border-white/10 text-white placeholder:text-gray-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wide text-gray-300">Last Name</label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    autoComplete="family-name"
                                    required
                                    value={lastName}
                                    onChange={event => setLastName(event.target.value)}
                                    placeholder="Doe"
                                    className="bg-slate-900/60 border-white/10 text-white placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-300">
                                <Mail className="h-3.5 w-3.5" /> Email Address
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={accountEmail}
                                readOnly
                                aria-readonly="true"
                                className="cursor-not-allowed bg-slate-950/70 border-white/10 text-gray-400"
                                placeholder="you@example.com"
                            />
                            <p className="text-[11px] text-gray-500">Your account email is shown for reference and cannot be changed here.</p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="phone" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-300">
                                <Phone className="h-3.5 w-3.5" /> Phone Number
                            </label>
                            <Input
                                id="phone"
                                type="tel"
                                autoComplete="tel"
                                required
                                value={phone}
                                onChange={event => setPhone(event.target.value)}
                                placeholder="07123 456789"
                                className="bg-slate-900/60 border-white/10 text-white placeholder:text-gray-600"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="location" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-300">
                                    <MapPin className="h-3.5 w-3.5" /> City / Location
                                </label>
                                <Input
                                    id="location"
                                    type="text"
                                    autoComplete="address-level2"
                                    required
                                    value={location}
                                    onChange={event => setLocation(event.target.value)}
                                    placeholder="Birmingham"
                                    className="bg-slate-900/60 border-white/10 text-white placeholder:text-gray-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="postcode" className="text-xs font-bold uppercase tracking-wide text-gray-300">Postcode</label>
                                <Input
                                    id="postcode"
                                    type="text"
                                    autoComplete="postal-code"
                                    required
                                    value={postcode}
                                    onChange={event => setPostcode(event.target.value.toUpperCase())}
                                    placeholder="B1 1AA"
                                    className="bg-slate-900/60 border-white/10 text-white placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-xs leading-relaxed text-gray-400">
                            All fields are required. This setup cannot be skipped because CarMazium requires complete basic account-holder details before dashboard access.
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            disabled={saving || !isVerified}
                        >
                            {saving ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                            ) : isVerified ? (
                                "Complete My Account"
                            ) : (
                                "Verify Email to Complete"
                            )}
                        </Button>
                    </form>
                </section>
            </div>
        </main>
    )
}
