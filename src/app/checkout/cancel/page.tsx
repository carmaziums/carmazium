"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { XCircle, ArrowLeft, RefreshCw, Home, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export default function CheckoutCancelPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <CheckoutCancelContent />
        </Suspense>
    )
}

function CheckoutCancelContent() {
    const searchParams = useSearchParams()
    const listingId = searchParams.get("listing_id")

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#1a2744] to-slate-900 -z-10" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="max-w-lg w-full text-center space-y-8"
            >
                {/* Cancel icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20"
                >
                    <XCircle size={48} className="text-white" strokeWidth={2.5} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">Payment Cancelled</h1>
                    <p className="mt-3 text-lg" style={{ color: 'var(--text-muted)' }}>
                        No worries — your payment was not processed and no charges were made.
                    </p>
                </motion.div>

                {/* Info card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-2xl border p-5 text-sm text-left"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                >
                    <p>Your card has <strong className="text-white">not been charged</strong>. The vehicle is still available if you&apos;d like to try again.</p>
                </motion.div>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    {listingId && (
                        <Button asChild className="gap-2 bg-gradient-to-r from-primary to-[#ff4d4d] hover:from-[#ff4d4d] hover:to-primary px-6">
                            <Link href={`/vehicle/${listingId}`}>
                                <ArrowLeft size={18} /> Back to Vehicle
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline" className="gap-2 border-white/20 hover:bg-white/5">
                        <Link href="/search">
                            <RefreshCw size={18} /> Browse More Cars
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="gap-2 border-white/20 hover:bg-white/5">
                        <Link href="/">
                            <Home size={18} /> Home
                        </Link>
                    </Button>
                </motion.div>
            </motion.div>
        </div>
    )
}
