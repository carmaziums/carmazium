"use client"

import { Button } from "@/components/ui/Button"
import { CheckCircle, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export default function OnboardingPage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [resending, setResending] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const [isVerified, setIsVerified] = useState(false)

    // Check if user is verified
    useEffect(() => {
        if (user) {
            setIsVerified(!!user.email_confirmed_at)
        }
    }, [user])

    // Check URL params for verification status
    useEffect(() => {
        const verified = searchParams?.get('verified')
        if (verified === 'true') {
            setIsVerified(true)
        }
    }, [searchParams])

    const getBaseUrl = () => {
        if (typeof window !== 'undefined') {
            return window.location.origin
        }
        return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }

    const handleResendEmail = async () => {
        if (!user?.email) return

        setResending(true)
        setResendSuccess(false)

        try {
            const baseUrl = getBaseUrl()
            const redirectTo = `${baseUrl}/auth/callback?redirect_to=/auth/onboarding`

            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
                options: {
                    emailRedirectTo: redirectTo
                }
            })

            if (error) {
                console.error('Error resending email:', error)
                alert(`Failed to resend email: ${error.message}`)
            } else {
                setResendSuccess(true)
                setTimeout(() => setResendSuccess(false), 5000)
            }
        } catch (err: any) {
            console.error('Unexpected error:', err)
            alert(`Failed to resend email: ${err.message}`)
        } finally {
            setResending(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="animate-spin text-primary h-12 w-12" />
            </div>
        )
    }

    const roleName = profile?.role?.toLowerCase() || 'member'

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-slate-900 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[url('/assets/images/hero-bg.png')] bg-cover opacity-20 mask-image-linear-to-l" />

            <div className="relative z-10 w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-12 flex flex-col md:flex-row gap-12">

                {/* Left Content */}
                <div className="flex-1 space-y-6">
                    <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                        <CheckCircle className="text-primary h-8 w-8" />
                    </div>

                    <h1 className="text-4xl font-bold font-heading">Welcome, {profile?.firstName || 'User'}!</h1>
                    <p className="text-gray-300 text-lg leading-relaxed">
                        Your {roleName} account has been created. You're just a few steps away from unlocking full access to auctions, selling tools, and more.
                    </p>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-4 text-gray-400">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                            <span>Verify your email address</span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 font-bold">2</div>
                            <span>Complete your {roleName} profile</span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 font-bold">3</div>
                            <span>Connect payment method</span>
                        </div>
                    </div>
                </div>

                {/* Right Content */}
                <div className="flex-1 bg-white/5 rounded-xl p-8 flex flex-col justify-center text-center border border-white/5">
                    {isVerified ? (
                        <>
                            <div className="inline-block p-3 bg-green-500/20 rounded-full mb-4 mx-auto">
                                <CheckCircle className="text-green-500 h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-bold mb-2 text-green-400">Email Verified!</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                Your email has been successfully verified. You can now access all features.
                            </p>
                            <Button size="lg" className="w-full" onClick={() => router.push('/dashboard')}>
                                Go to Dashboard
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="inline-block p-3 bg-primary/20 rounded-full mb-4 mx-auto">
                                <Mail className="text-primary h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                We've sent a verification link to <strong className="text-white">{user?.email || 'your email'}</strong>. Please click the link to continue.
                            </p>

                            {resendSuccess && (
                                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                                    Verification email sent! Please check your inbox.
                                </div>
                            )}

                            <Button 
                                size="lg" 
                                className="w-full mb-4" 
                                onClick={() => router.push('/dashboard')}
                                variant="outline"
                            >
                                Go to Dashboard
                            </Button>
                            <Button 
                                variant="ghost" 
                                className="w-full text-gray-400 hover:text-white" 
                                onClick={handleResendEmail}
                                disabled={resending}
                            >
                                {resending ? (
                                    <>
                                        <Loader2 className="animate-spin h-4 w-4 mr-2 inline" />
                                        Sending...
                                    </>
                                ) : (
                                    'Resend Email'
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
