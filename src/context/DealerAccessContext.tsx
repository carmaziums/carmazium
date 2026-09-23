"use client"

import React from "react"
import { useAuth } from "@/context/AuthContext"
import {
    DealerAccess,
    DealerPermission,
    dealerHasPermission,
    getDealerAccess,
} from "@/lib/dealerAccess"

type DealerAccessContextValue = {
    access: DealerAccess | null
    loading: boolean
    error: string | null
    has: (permission: DealerPermission) => boolean
    refresh: () => Promise<void>
}

const DealerAccessContext = React.createContext<DealerAccessContextValue | null>(null)

export function DealerAccessProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth()
    const [access, setAccess] = React.useState<DealerAccess | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        if (!user) {
            setAccess(null)
            setError(null)
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        try {
            setAccess(await getDealerAccess())
        } catch (err: any) {
            // A brand-new DEALER account may not have a DealerProfile until
            // the owner starts KYC. The layout deliberately treats that as an
            // unverified owner state rather than manufacturing staff access.
            setAccess(null)
            setError(err?.message || "Could not load dealership access")
        } finally {
            setLoading(false)
        }
    }, [user])

    React.useEffect(() => {
        if (authLoading) return
        void refresh()
    }, [authLoading, refresh])

    const value = React.useMemo<DealerAccessContextValue>(() => ({
        access,
        loading: authLoading || loading,
        error,
        has: (permission) => dealerHasPermission(access, permission),
        refresh,
    }), [access, authLoading, loading, error, refresh])

    return (
        <DealerAccessContext.Provider value={value}>
            {children}
        </DealerAccessContext.Provider>
    )
}

export function useDealerAccess(): DealerAccessContextValue {
    const value = React.useContext(DealerAccessContext)
    if (!value) {
        throw new Error("useDealerAccess must be used inside DealerAccessProvider")
    }
    return value
}
