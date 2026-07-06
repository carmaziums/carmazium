"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Lock, LogIn, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface LoginWallProps {
    open: boolean
    onClose: () => void
    /** Where to redirect after auth (defaults to current path) */
    redirectTo?: string
    /** Optional message shown above the buttons */
    message?: string
}

export function LoginWall({
    open,
    onClose,
    redirectTo,
    message = "Sign in or create an account to continue.",
}: LoginWallProps) {
    const router = useRouter()
    const redirect = redirectTo || (typeof window !== "undefined" ? window.location.pathname : "/")

    if (!open) return null

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Icon */}
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                    <Lock size={22} className="text-primary" />
                </div>

                <h3 className="text-lg font-bold text-center text-[var(--text-primary)] mb-2">Login Required</h3>
                <p className="text-sm text-[var(--text-muted)] text-center mb-6">{message}</p>

                <div className="space-y-3">
                    <Button
                        onClick={() => { onClose(); router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`) }}
                        className="w-full shadow-neon gap-2"
                    >
                        <LogIn size={16} /> Log In
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => { onClose(); router.push(`/auth/signup?redirect=${encodeURIComponent(redirect)}`) }}
                        className="w-full border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] gap-2"
                    >
                        <UserPlus size={16} /> Create Account
                    </Button>
                </div>
            </div>
        </div>
    )
}
