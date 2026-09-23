"use client"

import * as React from "react"
import {
    DealerAccess,
    DealerPermission,
    getDealerAccess,
} from "@/lib/dealerAccess"

interface DealerAccessContextValue {
    access: DealerAccess | null
    loading: boolean
    error: string | null
    hasPermission: (permission: DealerPermission) => boolean
    refresh: () => Promise<void>
}

const DealerAccessContext = React.createContext<DealerAccessContextValue>({
    access: null,
    loading: false,
    error: null,
    hasPermission: () => false,
    refresh: async () => {},
})

export function DealerAccessProvider({ children }: { children: React.ReactNode }) {
    const [access, setAccess] = React.useState<DealerAccess | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const next = await getDealerAccess()
            setAccess(next)
        } catch (err: any) {
            setAccess(null)
            setError(err?.message || "Unable to load dealership permissions.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    const hasPermission = React.useCallback(
        (permission: DealerPermission) => !!access?.permissions?.includes(permission),
        [access],
    )

    const value = React.useMemo(
        () => ({ access, loading, error, hasPermission, refresh }),
        [access, loading, error, hasPermission, refresh],
    )

    return (
        <DealerAccessContext.Provider value={value}>
            {children}
        </DealerAccessContext.Provider>
    )
}

export function useDealerAccess() {
    return React.useContext(DealerAccessContext)
}
