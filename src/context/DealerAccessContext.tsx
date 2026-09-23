"use client"

import * as React from "react"
import {
    DealerAccess,
    DealerPermission,
    getDealerAccess,
    hasDealerPermission,
} from "@/lib/dealerAccess"

type DealerAccessContextValue = {
    access: DealerAccess | null
    loading: boolean
    error: string | null
    refresh: () => Promise<void>
    can: (permission?: DealerPermission | null) => boolean
}

const DealerAccessContext = React.createContext<DealerAccessContextValue | null>(null)

export function DealerAccessProvider({ children }: { children: React.ReactNode }) {
    const [access, setAccess] = React.useState<DealerAccess | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setAccess(await getDealerAccess())
        } catch (err: any) {
            setAccess(null)
            setError(err?.message || "Could not load dealership permissions")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    const can = React.useCallback(
        (permission?: DealerPermission | null) =>
            hasDealerPermission(access, permission),
        [access],
    )

    return (
        <DealerAccessContext.Provider value={{ access, loading, error, refresh, can }}>
            {children}
        </DealerAccessContext.Provider>
    )
}

export function useDealerAccess() {
    const context = React.useContext(DealerAccessContext)
    if (!context) {
        throw new Error("useDealerAccess must be used inside DealerAccessProvider")
    }
    return context
}

export function useOptionalDealerAccess() {
    return React.useContext(DealerAccessContext)
}
