"use client"

import * as React from "react"
import {
    getPublicServiceAvailability,
    type ServiceAvailability,
} from "@/lib/servicesApi"

/**
 * Customer-facing TradeXchange pages use the backend's runtime availability
 * state so Vercel build-time flags cannot disagree with the live API.
 *
 * Fail closed if the availability endpoint cannot be reached. Existing job and
 * enquiry pages do not use this hook, so an outage or kill switch never hides
 * work that already exists.
 */
export function useTradeXchangeAvailability() {
    const [availability, setAvailability] = React.useState<ServiceAvailability | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        let active = true
        getPublicServiceAvailability()
            .then((value) => {
                if (!active) return
                setAvailability(value)
                setError(null)
            })
            .catch(() => {
                if (!active) return
                setAvailability(null)
                setError("Could not verify live TradeXchange service availability.")
            })
        return () => { active = false }
    }, [])

    return {
        availability,
        loading: availability === null && error === null,
        error,
    }
}
