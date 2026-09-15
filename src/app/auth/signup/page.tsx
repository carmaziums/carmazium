"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Building2, Car, Eye, EyeOff, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { fetchWithRetry } from "@/lib/fetchWithRetry"
import { friendlyAuthError } from "@/lib/authErrors"

// New business signups use one Partner Account. DEALER remains the internal
// compatibility role so existing auctions, KYC and staff rules keep working;
// Delivery/Inspection are capabilities added after signup, not account roles.
const VALID_SIGNUP_ROLES = ["BUYER", "SELLER", "DEALER"] as const

type SignupRole = typeof VALID_SIGNUP_ROLES[number]

function AppleLogo({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={`${className} fill-current`} viewBox="0 0 384 512" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
    )
}

export default function SignupPage() {
    return (
        <React.Suspense fallback={null}>
            <SignupForm />
        </React.Suspense>
    )
}

function SignupForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const roleParam = searchParams.get("role")?.toUpperCase()
    const initialRole = (VALID_SIGNUP_ROLES as readonly string[]).includes(roleParam ?? "")
        ? roleParam as SignupRole
        : ""

    const [formData, setFormData] = React.useState<{
        firstName: string
        lastName: string
        email: string
        password: string
        role: SignupRole | ""
    }>({ firstName: "", lastName: "", email: "", password: "", role: initialRole })
    const [loading, setLoading] = React.useState(false)
    const [googleLoading, setGoogleLoading] = React.useState(false)
    const [appleLoading, setAppleLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
    const getBaseUrl = () => typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")

    const registrationDestination = "/auth/registration-complete?next=/auth/onboarding"
    const getRegistrationCallbackUrl = (baseUrl: string) => {
        const role = formData.role ? `&role=${encodeURIComponent(formData.role)}` : ""
        return `${baseUrl}/auth/callback?redirect_to=${encodeURIComponent(registrationDestination)}${role}`
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.role) {
            setError("Please select an account type to continue.")
            return
        }
        setLoading(true)
        setError(null)

        try {
            const baseUrl = getBaseUrl()
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    emailRedirectTo: getRegistrationCallbackUrl(baseUrl),
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        role: formData.role,
                    },
                },
            })
            if (authError) throw authError

            if (authData.user) {
                const apiBase = API_URL.replace(/\/$/, "")
                try {
                    const syncResponse = await fetchWithRetry(
                        `${apiBase}/users/sync`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(authData.session?.access_token
                                    ? { Authorization: `Bearer ${authData.session.access_token}` }
                                    : {}),
                            },
                            body: JSON.stringify({
                                email: formData.email,
                                firstName: formData.firstName,
                                lastName: formData.lastName,
                                role: formData.role,
                            }),
                        },
                        { timeoutMs: 60000, retries: 2 },
                    )
                    if (syncResponse.ok && authData.session?.access_token) {
                        await fetchWithRetry(
                            `${apiBase}/auth/supabase-session`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ token: authData.session.access_token }),
                                credentials: "include",
                            },
                            { timeoutMs: 60000, retries: 2 },
                        ).catch(err => console.error("Session bridge failed:", err))
                    }
                } catch (syncError) {
                    console.error("Backend sync failed, but account was created in Supabase", syncError)
                }
            }

            if (typeof window !== "undefined") {
                sessionStorage.setItem("pending_verification_email", formData.email)
            }
            // If Supabase created a session immediately, registration is already
            // complete. Otherwise onboarding shows the email-verification step;
            // the verification callback returns to the success page above.
            router.push(authData.session ? registrationDestination : "/auth/onboarding")
        } catch (err: any) {
            console.error("Signup failed:", err)
            setError(friendlyAuthError(err, "An error occurred during signup. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    const handleAppleSignup = async () => {
        setAppleLoading(true)
        setError(null)
        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: "apple",
                options: {
                    redirectTo: getRegistrationCallbackUrl(window.location.origin),
                },
            })
            if (oauthError) throw oauthError
        } catch (err: any) {
            setError(friendlyAuthError(err, "Apple sign-in failed. Please try again."))
            setAppleLoading(false)
        }
    }

    const roles = [
        {
            id: "BUYER" as SignupRole,
            icon: Car,
            label: "Personal Account",
            sub: "Buy and sell vehicles as an individual",
            active: "bg-blue-500/20 text-blue-400",
            hover: "group-hover:bg-blue-500/20 group-hover:text-blue-400",
        },
        {
            id: "DEALER" as SignupRole,
            icon: Building2,
            label: "Partner Account",
            sub: "One business login — add Vehicle Dealer, Delivery and Inspection services",
            active: "bg-primary/20 text-primary",
            hover: "group-hover:bg-primary/20 group-hover:text-primary",
        },
    ]
    const selectedRole = roles.find(r => r.id === formData.role)

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-[url('/assets/images/signup-bg.png')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md p-8 shadow-2xl border border-white/20 rounded-2xl text-white">
                <Link href="/" className="inline-flex items-center text-gray-300 hover:text-white mb-6 text-sm font-medium transition-colors">
                    <ArrowLeft size={16} className="mr-1" /> Back to Home
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 font-heading">Create Account</h1>
                    <p className="text-gray-300">Personal account or one Partner Account for your business</p>
                </div>

                {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">{error}</div>}

                <form className="space-y-6" onSubmit={handleSignup}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="fname" className="text-xs font-bold uppercase tracking-wide block text-gray-200">First Name</label>
                            <Input id="fname" type="text" placeholder="John" required value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="lname" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Last Name</label>
                            <Input id="lname" type="text" placeholder="Doe" required value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Email Address</label>
                        <Input id="email" type="email" placeholder="john@example.com" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Password</label>
                        <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} placeholder="Create a password" required value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30 pr-11" />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 relative group-dropdown">
                        <label className="text-xs font-bold uppercase tracking-wide block text-gray-200">Account Type</label>
                        <div className="relative">
                            <input type="checkbox" id="dropdown-toggle" className="peer hidden" />
                            <label htmlFor="dropdown-toggle" className="flex items-center justify-between w-full min-h-14 px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl cursor-pointer text-white hover:border-primary/50 transition-colors">
                                {selectedRole ? (
                                    <span className="flex items-center gap-3 text-left">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedRole.active}`}><selectedRole.icon size={16} /></span>
                                        <span><span className="block font-semibold">{selectedRole.label}</span><span className="block text-[11px] text-gray-400 mt-0.5">{selectedRole.sub}</span></span>
                                    </span>
                                ) : <span className="text-gray-400">Select your account type...</span>}
                                <ArrowLeft className="rotate-[-90deg] text-gray-400" size={16} />
                            </label>
                            <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden hidden peer-checked:block z-50">
                                {roles.map(role => (
                                    <div key={role.id} onClick={() => {
                                        setFormData(p => ({ ...p, role: role.id }))
                                        const toggle = document.getElementById("dropdown-toggle") as HTMLInputElement
                                        if (toggle) toggle.checked = false
                                    }} className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 group">
                                        <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${role.hover}`}><role.icon size={18} /></div>
                                        <div><p className="font-semibold">{role.label}</p><p className="text-xs text-gray-400">{role.sub}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full h-12 text-lg shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">
                        {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
                    </Button>
                </form>

                <div className="my-8 flex items-center gap-4 text-gray-400"><div className="h-px bg-white/10 flex-1" /><span className="text-sm">Or continue with</span><div className="h-px bg-white/10 flex-1" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" disabled={googleLoading || appleLoading} onClick={async () => {
                        setGoogleLoading(true); setError(null)
                        try {
                            if (!formData.role) {
                                setError("Please select an account type before continuing with Google.")
                                setGoogleLoading(false)
                                return
                            }
                            const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: getRegistrationCallbackUrl(window.location.origin) } })
                            if (oauthError) throw oauthError
                        } catch (err: any) {
                            setError(friendlyAuthError(err, "Google sign-in failed")); setGoogleLoading(false)
                        }
                    }} className="w-full border-white/20 hover:bg-white/10 text-white h-12 gap-3">
                        {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image src="/assets/images/google-icon.png" alt="Google" width={20} height={20} className="w-5 h-5" />}
                        <span className="text-sm font-medium">Google</span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={appleLoading || googleLoading}
                        onClick={async () => {
                            if (!formData.role) {
                                setError("Please select an account type before continuing with Apple.")
                                return
                            }
                            await handleAppleSignup()
                        }}
                        className="w-full border-white/20 hover:bg-white/10 text-white h-12 gap-3"
                    >
                        {appleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleLogo />}
                        <span className="text-sm font-medium">Apple</span>
                    </Button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-300">Already have an account? <Link href="/auth/login" className="text-primary font-bold hover:text-red-400">Log In</Link></div>
                <div className="mt-4 text-center text-xs text-gray-400">Businesses use one <span className="text-white font-semibold">Partner Account</span> and add services from the Partner Dashboard.</div>
            </div>
        </div>
    )
}
