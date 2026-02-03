"use client"

import { Button } from "@/components/ui/Button"
import { CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

export default function OnboardingPage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()

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
                    <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
                    <p className="text-gray-400 text-sm mb-6">
                        We've sent a verification link to <strong className="text-white">{user?.email || 'your email'}</strong>. Please click the link to continue.
                    </p>

                    <Button size="lg" className="w-full mb-4" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                    <Button variant="ghost" className="w-full text-gray-400 hover:text-white">Resend Email</Button>
                </div>
            </div>
        </div>
    )
}
