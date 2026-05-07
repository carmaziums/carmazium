"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Loader2, Eye, EyeOff, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user, loading: authLoading } = useAuth()
    const [formData, setFormData] = React.useState({
        email: "",
        password: ""
    })
    const [loading, setLoading] = React.useState(false)
    const [googleLoading, setGoogleLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)

    const targetAfterLogin = searchParams?.get("redirect") || "/dashboard"

    const getSafeErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof Error && err.message?.trim()) return err.message
        if (typeof err === "string" && err.trim()) return err
        if (err && typeof err === "object") {
            const maybeMessage = (err as any).message || (err as any).error || (err as any).details
            if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage
        }
        return fallback
    }

    // Redirect authenticated users to the intended destination
    React.useEffect(() => {
        if (!authLoading && user) {
            router.replace(targetAfterLogin)
        }
    }, [user, authLoading, router, targetAfterLogin])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            })

            if (authError) {
                // Check for email verification error
                if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
                    throw new Error('Please verify your email address before logging in. Check your inbox for the verification link.')
                }
                throw authError
            }

            // Check if email is verified
            if (data.user && !data.user.email_confirmed_at) {
                // Sign out and redirect to onboarding
                await supabase.auth.signOut()
                router.push('/auth/onboarding?verified=false')
                setError('Please verify your email address before logging in. Check your inbox for the verification link.')
                return
            }

            // Do not block UX on backend bridge here; AuthContext handles bridge/profile sync.
            router.replace(targetAfterLogin)
        } catch (err: unknown) {
            setError(getSafeErrorMessage(err, 'Invalid email or password'))
        } finally {
            setLoading(false)
        }
    }

    // Show loading while checking auth state
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // If user is authenticated, don't render login form (redirect will happen)
    if (user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-[url('/assets/images/signup-bg.png')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md p-8 shadow-2xl border border-white/20 rounded-2xl text-white">
                <Link href="/" className="inline-flex items-center text-gray-300 hover:text-white mb-6 text-sm font-medium transition-colors">
                    <ArrowLeft size={16} className="mr-1" /> Back to Home
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 font-heading">Welcome Back</h1>
                    <p className="text-gray-300">Login to continue to CarMazium.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Email Address</label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Password</label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30 pr-11"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                            <input type="checkbox" className="accent-primary h-4 w-4" />
                            Remember me
                        </label>
                        <Link href="/auth/forgot-password" className="text-primary hover:text-red-400 font-medium transition-colors">Forgot Password?</Link>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full h-12 text-lg shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">
                        {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
                    </Button>
                </form>

                <div className="my-8 flex items-center gap-4 text-gray-400">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-sm">Or continue with</span>
                    <div className="h-px bg-white/10 flex-1" />
                </div>

                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        disabled={googleLoading}
                        onClick={async () => {
                            setGoogleLoading(true)
                            setError(null)
                            try {
                                const redirectTo = `${window.location.origin}/auth/callback?redirect_to=/dashboard`
                                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: { redirectTo },
                                })
                                if (oauthError) throw oauthError
                            } catch (err: any) {
                                setError(getSafeErrorMessage(err, 'Google sign-in failed'))
                                setGoogleLoading(false)
                            }
                        }}
                        className="flex-1 border-white/20 hover:bg-white/10 text-white h-12 gap-3"
                    >
                        {googleLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Image src="/assets/images/google-icon.png" alt="Google" width={20} height={20} className="w-5 h-5" />
                        )}
                        <span className="text-sm font-medium">Google</span>
                    </Button>
                    <Button variant="outline" className="flex-1 border-white/20 hover:bg-white/10 text-white h-12 gap-3">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 384 512">
                            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                        </svg>
                        <span className="text-sm font-medium">Apple</span>
                    </Button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-300">
                    Don't have an account? <Link href="/auth/signup" className="text-primary font-bold hover:text-red-400 transition-colors">Sign Up</Link>
                </div>

                <div className="mt-4 text-center">
                    <Link href="/auth/signup" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group">
                        <Building2 size={16} className="text-gray-500 group-hover:text-primary transition-colors" />
                        <span>Are you a dealer? <span className="text-primary font-semibold">Register your dealership →</span></span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
