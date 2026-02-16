"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Loader2, Banknote, Shield, Briefcase, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

export default function PartnersLoginPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const [formData, setFormData] = React.useState({
        email: "",
        password: ""
    })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // Redirect authenticated users to dashboard
    React.useEffect(() => {
        if (!authLoading && user) {
            router.push('/dashboard')
        }
    }, [user, authLoading, router])

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
                if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
                    throw new Error('Please verify your email address before logging in.')
                }
                throw authError
            }

            if (data.user && !data.user.email_confirmed_at) {
                throw new Error('Please verify your email address before logging in.')
            }

            if (data.session?.access_token) {
                try {
                    await apiClient('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({
                            email: formData.email,
                            supabaseToken: data.session.access_token,
                        }),
                    })
                } catch (bridgeErr) {
                    console.warn('Backend session bridge failed:', bridgeErr)
                }
            }

            router.push('/dashboard')
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-5 py-20 relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Back Link */}
                <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft size={16} className="mr-2" /> Back to CarMazium
                </Link>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                            <Banknote size={24} className="text-emerald-400" />
                        </div>
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                            <Shield size={24} className="text-blue-400" />
                        </div>
                        <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                            <Briefcase size={24} className="text-orange-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black font-heading text-white mb-2">Partners Portal</h1>
                    <p className="text-gray-400">Finance Providers &bull; Insurance Partners &bull; Contractors</p>
                </div>

                {/* Login Form */}
                <div className="glass-card border border-white/10 bg-white/5 rounded-2xl p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="partner@company.com"
                                required
                                className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="••••••••"
                                required
                                className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 font-bold text-base"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing In...</>
                            ) : (
                                <><Building2 size={18} className="mr-2" /> Sign In to Partner Dashboard</>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-gray-500">
                            Not a partner?{" "}
                            <Link href="/auth/login" className="text-primary hover:text-white font-bold transition-colors">
                                Regular Login
                            </Link>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            New partner?{" "}
                            <Link href="/auth/signup" className="text-primary hover:text-white font-bold transition-colors">
                                Register
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Partner Features */}
                <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
                        <Banknote size={20} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Finance</p>
                        <p className="text-xs text-gray-500 mt-1">Manage applications</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
                        <Shield size={20} className="text-blue-400 mx-auto mb-2" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Insurance</p>
                        <p className="text-xs text-gray-500 mt-1">Process quotes</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
                        <Briefcase size={20} className="text-orange-400 mx-auto mb-2" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Service</p>
                        <p className="text-xs text-gray-500 mt-1">Handle jobs</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
