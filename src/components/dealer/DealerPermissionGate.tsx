"use client"

import React from "react"
import Link from "next/link"
import { Loader2, LockKeyhole } from "lucide-react"
import { DealerPermission } from "@/lib/dealerAccess"
import { useDealerAccess } from "@/context/DealerAccessContext"

export function DealerPermissionGate({
    permission,
    title = "Access restricted",
    description = "Your dealership role does not include this area.",
    children,
}: {
    permission: DealerPermission
    title?: string
    description?: string
    children: React.ReactNode
}) {
    const { loading, has } = useDealerAccess()

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        )
    }

    if (!has(permission)) {
        return (
            <div className="min-h-[55vh] flex items-center justify-center px-6">
                <div className="max-w-md w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <LockKeyhole size={22} className="text-amber-500" />
                    </div>
                    <h1 className="text-xl font-black font-heading">{title}</h1>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
                    <Link
                        href="/dashboard/dealer"
                        className="inline-flex mt-6 min-h-[44px] items-center justify-center rounded-xl px-5 bg-primary text-white text-sm font-bold"
                    >
                        Back to dealer dashboard
                    </Link>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
