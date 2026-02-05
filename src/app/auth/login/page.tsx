"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
    const router = useRouter()
    const [formData, setFormData] = React.useState({
        email: "",
        password: ""
    })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            })

            if (authError) throw authError

            // Sync with backend to ensure user exists locally
            if (data.user) {
                try {
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com'
                    await fetch(`${API_URL}/users/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            supabaseAuthId: data.user.id,
                            email: formData.email,
                            // We might not have metadata on login, but sync handles updates.
                            // Sending what we have ensures existence.
                        })
                    })
                } catch (syncErr) {
                    console.error('Login sync failed:', syncErr)
                    // Continue to dashboard anyway, auth context might retry or show error
                }
            }

            router.push('/dashboard')
        } catch (err: any) {
            setError(err.message || 'Invalid email or password')
        } finally {
            setLoading(false)
        }
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
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30"
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                            <input type="checkbox" className="accent-primary h-4 w-4" />
                            Remember me
                        </label>
                        <Link href="#" className="text-primary hover:text-red-400 font-medium transition-colors">Forgot Password?</Link>
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
                    <Button variant="outline" className="flex-1 border-white/20 hover:bg-white/10 text-white">
                        <span className="sr-only">Google</span>
                        <img src="/assets/images/google-icon.png" alt="Google" className="w-5 h-5 mx-auto" />
                    </Button>
                    <Button variant="outline" className="flex-1 border-white/20 hover:bg-white/10 text-white h-12">
                        <span className="sr-only">Apple</span>
                        <svg className="w-5 h-5 mx-auto fill-current" viewBox="0 0 24 24">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.54-2.08-.55-3.18 0-1.15.58-1.95.5-3.04-.54-2.61-2.5-3.26-6.84-.75-10.42 1.48-2.11 3.53-2.3 4.96-.86.74.75 1.54.91 2.37.07 1.3-1.32 3.19-1.21 4.79-.18.15.65.3.93.42 1.13-2.19-1.57-2.9-4.22-1.77-5.91 2.5 1.7 3.25 4.79 1.48 7.08-1.07 1.41-2.08 2.44-3.56 3.9l1.36 5.35z" />
                        </svg>
                    </Button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-300">
                    Don't have an account? <Link href="/auth/signup" className="text-primary font-bold hover:text-red-400 transition-colors">Sign Up</Link>
                </div>
            </div>
        </div>
    )
}
