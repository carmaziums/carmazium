"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Building2, Eye, EyeOff, Loader2, RefreshCw, ShieldAlert, LogOut, ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"

function AppleLogo({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={`${className} fill-current`} viewBox="0 0 384 512" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
    )
}

function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth()
    const [formData, setFormData] = React.useState({ email: "", password: "" })
    const [loading, setLoading] = React.useState(false)
    const [googleLoading, setGoogleLoading] = React.useState(false)
    const [appleLoading, setAppleLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)
    const [retryingProfile, setRetryingProfile] = React.useState(false)
    const [endingSession, setEndingSession] = React.useState(false)
    const [showManualNavigation, setShowManualNavigation] = React.useState(false)
    const rawTargetAfterLogin = searchParams?.get("redirect") || "/dashboard"
    const targetAfterLogin =
        rawTargetAfterLogin.startsWith("/") && !rawTargetAfterLogin.startsWith("//")
            ? rawTargetAfterLogin
            : "/dashboard"

    const getSafeErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof Error && err.message?.trim()) return err.message
        if (typeof err === "string" && err.trim()) return err
        if (err && typeof err === "object") {
            const maybeMessage = (err as any).message || (err as any).error || (err as any).details
            if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage
        }
        return fallback
    }

    // A genuine backend profile (not Supabase metadata) determines the
    // dashboard. This preserves exclusive administrator routing.
    const destination = profile?.role === "ADMIN"
        ? (targetAfterLogin.startsWith("/dashboard/admin") ? targetAfterLogin : "/dashboard/admin")
        : profile?.role === "DEALER" && targetAfterLogin === "/dashboard"
            ? "/dashboard/dealer"
            : targetAfterLogin

    React.useEffect(() => {
        if (authLoading || !user || !profile) return
        setShowManualNavigation(false)
        const timer = window.setTimeout(() => setShowManualNavigation(true), 7000)
        router.replace(destination)
        return () => window.clearTimeout(timer)
    }, [user, profile, authLoading, router, destination])

    const retryAccountVerification = async () => {
        setRetryingProfile(true)
        setError(null)
        try {
            await refreshProfile()
        } catch (err: unknown) {
            setError(getSafeErrorMessage(err, "Unable to check your account right now. Please try again."))
        } finally {
            setRetryingProfile(false)
        }
    }

    const signOutAndRetry = async () => {
        setEndingSession(true)
        setError(null)
        try {
            await signOut()
            // Leave the login page mounted: the now-empty session shows the form.
            router.replace("/auth/login")
        } catch (err: unknown) {
            setError(getSafeErrorMessage(err, "Unable to sign out. Please try again."))
        } finally {
            setEndingSession(false)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword(formData)
            if (authError) {
                if (authError.message.includes("Email not confirmed") || authError.message.includes("email_not_confirmed")) {
                    throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.")
                }
                throw authError
            }
            if (data.user && !data.user.email_confirmed_at) {
                await supabase.auth.signOut()
                router.push("/auth/onboarding?verified=false")
                setError("Please verify your email address before logging in. Check your inbox for the verification link.")
            }
        } catch (err: unknown) {
            setError(getSafeErrorMessage(err, "Invalid email or password"))
        } finally {
            setLoading(false)
        }
    }

    const handleAppleLogin = async () => {
        setAppleLoading(true)
        setError(null)
        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: "apple",
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?redirect_to=/auth/onboarding`,
                },
            })
            if (oauthError) throw oauthError
        } catch (err: unknown) {
            setError(getSafeErrorMessage(err, "Apple sign-in failed. Please try again."))
            setAppleLoading(false)
        }
    }

    if (authLoading) {
        return (
            <div role="status" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-slate-300">Checking your sign-in session...</p>
            </div>
        )
    }

    // Previously any authenticated user stayed on an infinite spinner whenever
    // /users/me failed, even after the auth context had finished loading.
    if (user && !profile) {
        return (
            <div className="min-h-screen bg-slate-900 px-5 py-24 text-white flex items-center justify-center">
                <div role="alert" className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-slate-800/90 p-7 text-center shadow-2xl">
                    <ShieldAlert className="mx-auto mb-4 h-11 w-11 text-amber-300" aria-hidden="true" />
                    <h1 className="text-2xl font-black">Account verification temporarily unavailable</h1>
                    <p className="mt-4 text-sm leading-6 text-slate-200">
                        You are signed in, but we couldn&apos;t confirm your CarMazium account
                        details from the server. Your dealer or admin permissions have not been
                        changed. Try again before signing out.
                    </p>
                    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
                    <button type="button" disabled={retryingProfile || endingSession}
                        onClick={retryAccountVerification}
                        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-60">
                        {retryingProfile ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                        {retryingProfile ? "Checking account..." : "Retry account verification"}
                    </button>
                    <button type="button" disabled={retryingProfile || endingSession}
                        onClick={signOutAndRetry}
                        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
                        {endingSession ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : <LogOut className="h-4 w-4" aria-hidden="true" />}
                        {endingSession ? "Signing out..." : "Sign out and try another account"}
                    </button>
                    <Link href="/" className="mt-5 inline-block text-sm text-slate-300 underline underline-offset-4">
                        Back to CarMazium
                    </Link>
                </div>
            </div>
        )
    }

    if (user && profile) {
        return (
            <div role="status" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 px-5 text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-slate-200">Opening your dashboard...</p>
                {showManualNavigation && (
                    <a href={destination} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white">
                        Open dashboard directly <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-[url('/assets/images/signup-bg.png')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md p-8 shadow-2xl border border-white/20 rounded-2xl text-white">
                <Link href="/" className="inline-flex items-center text-gray-300 hover:text-white mb-6 text-sm font-medium transition-colors"><ArrowLeft size={16} className="mr-1" /> Back to Home</Link>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 font-heading">Welcome Back</h1>
                    <p className="text-gray-300">One login for your Personal or Partner Account.</p>
                </div>
                {searchParams?.get("reason") === "session-expired" && (
                    <div role="status" className="mb-6 rounded-xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-100">
                        Your 24-hour sign-in period has ended. Please log in again to continue.
                    </div>
                )}
                {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">{error}</div>}

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Email Address</label>
                        <Input id="email" type="email" placeholder="john@example.com" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Password</label>
                        <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30 pr-11" />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">For security, sign-in expires after 24 hours.</span>
                        <Link href="/auth/forgot-password" className="text-primary hover:text-red-400 font-medium">Forgot Password?</Link>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-12 text-lg shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">{loading ? <Loader2 className="animate-spin" /> : "Log In"}</Button>
                </form>

                <div className="my-8 flex items-center gap-4 text-gray-400"><div className="h-px bg-white/10 flex-1" /><span className="text-sm">Or continue with</span><div className="h-px bg-white/10 flex-1" /></div>
                <div className="flex gap-4">
                    <Button variant="outline" disabled={googleLoading || appleLoading} onClick={async () => {
                        setGoogleLoading(true); setError(null)
                        try {
                            const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?redirect_to=/auth/onboarding` } })
                            if (oauthError) throw oauthError
                        } catch (err: any) {
                            setError(getSafeErrorMessage(err, "Google sign-in failed")); setGoogleLoading(false)
                        }
                    }} className="flex-1 border-white/20 hover:bg-white/10 text-white h-12 gap-3">
                        {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image src="/assets/images/google-icon.png" alt="Google" width={20} height={20} className="w-5 h-5" />}
                        <span className="text-sm font-medium">Google</span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={appleLoading || googleLoading}
                        onClick={handleAppleLogin}
                        className="flex-1 border-white/20 hover:bg-white/10 text-white h-12 gap-3"
                    >
                        {appleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleLogo />}
                        <span className="text-sm font-medium">Apple</span>
                    </Button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-300">Don't have an account? <Link href="/auth/signup" className="text-primary font-bold hover:text-red-400">Sign Up</Link></div>
                <div className="mt-4 text-center">
                    <Link href="/auth/signup?role=DEALER" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white group">
                        <Building2 size={16} className="text-gray-500 group-hover:text-primary" />
                        <span>Business? <span className="text-primary font-semibold">Create a Partner Account →</span></span>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><LoginContent /></React.Suspense>
}