"use client"

import * as React from "react"
import { Lock, Loader2, ShieldCheck } from "lucide-react"
import { useDealerAccess } from "@/context/DealerAccessContext"
import type { DealerPermission } from "@/lib/dealerAccess"

interface DealerPermissionGateProps {
    permission: DealerPermission
    children: React.ReactNode
    title?: string
    description?: string
}

export function DealerPermissionGate({
    permission,
    children,
    title = "This tool is not included in your dealership role",
    description = "Your dealership owner or administrator can change staff responsibilities from the Team area.",
}: DealerPermissionGateProps) {
    const { access, loading, error, hasPermission, refresh } = useDealerAccess()

    if (loading) {
        return (
            <div className="min-h-[55vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                    <Loader2 size={30} className="animate-spin text-primary" />
                    <p className="text-sm font-semibold">Checking dealership access…</p>
                </div>
            </div>
        )
    }

    if (!hasPermission(permission)) {
        return (
            <div className="min-h-[55vh] flex items-center justify-center px-5 py-16">
                <div className="w-full max-w-xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                        <Lock size={25} className="text-amber-400" />
                    </div>
                    <h2 className="text-xl font-black">{title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                        {description}
                    </p>
                    {access && (
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            <ShieldCheck size={13} />
                            {access.role.replaceAll("_", " ")}
                        </div>
                    )}
                    {error && (
                        <button
                            type="button"
                            onClick={refresh}
                            className="mt-5 block w-full text-sm font-bold text-primary hover:underline"
                        >
                            Retry access check
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return <>{children}</>
}
