"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
    const router = useRouter()
    const [formData, setFormData] = React.useState({
        password: "",
        confirmPassword: ""
    })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)

    // Note: User should already be authenticated via the token in the callback redirect
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: formData.password
            })

            if (updateError) throw updateError

            setSuccess(true)
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push("/dashboard")
            }, 3000)
            
        } catch (err: any) {
            setError(err.message || 'An error occurred while updating your password')
            // If they are not logged in or token is invalid, they might get an error here.
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-[url('/assets/images/signup-bg.png')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md p-8 shadow-2xl border border-white/20 rounded-2xl text-white">
                <Link href="/auth/login" className="inline-flex items-center text-gray-300 hover:text-white mb-6 text-sm font-medium transition-colors">
                    <ArrowLeft size={16} className="mr-1" /> Back to Login
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 font-heading">Set New Password</h1>
                    <p className="text-gray-300">Enter your new secure password below to regain access.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm flex gap-3 text-left">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                            <CheckCircle2 size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Password Updated!</h2>
                        <p className="text-gray-300 mb-6">Your password has been successfully reset. You will be redirected shortly.</p>
                        <Button onClick={() => router.push("/dashboard")} className="w-full h-12 shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">
                            Go to Dashboard
                        </Button>
                    </div>
                ) : (
                    <form className="space-y-6" onSubmit={handleUpdate}>
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide block text-gray-200">New Password</label>
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
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Confirm New Password</label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                required
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30"
                            />
                        </div>

                        <Button type="submit" disabled={loading} className="w-full h-12 text-lg shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">
                            {loading ? <Loader2 className="animate-spin" /> : 'Update Password'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
