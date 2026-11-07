"use client"
import React, { createContext, useContext, useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export interface LocationState {
    lat: number | null
    lng: number | null
    postcode: string | null
    source: 'geo' | 'postcode' | null
}

const LocationContext = createContext<{
    location: LocationState
    setPostcode: (pc: string) => void
}>({
    location: { lat: null, lng: null, postcode: null, source: null },
    setPostcode: () => {},
})

const GEO_KEY = 'carmazium_user_location'
const PC_KEY  = 'carmazium_user_postcode'
const CACHE_TTL = 10 * 60 * 1000

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [location, setLocation] = useState<LocationState>({
        lat: null, lng: null, postcode: null, source: null,
    })
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const postcodeRequestRef = useRef(0)

    useEffect(() => {
        const request = postcodeRequestRef.current
        // 1. Check cached geo coords
        try {
            const raw = localStorage.getItem(GEO_KEY)
            if (raw) {
                const c = JSON.parse(raw)
                if (Date.now() < c.expiresAt) {
                    setLocation({ lat: c.lat, lng: c.lng, postcode: null, source: 'geo' })
                    return
                }
            }
        } catch { /* ignore */ }

        // 2. Check cached postcode
        try {
            const pc = localStorage.getItem(PC_KEY)
            if (pc) {
                geocodePostcode(pc).then(coords => {
                    if (coords && request === postcodeRequestRef.current) setLocation({ ...coords, postcode: pc, source: 'postcode' })
                })
                return
            }
        } catch { /* ignore */ }

        // 3. Browser geolocation
        // Paid-search seller traffic must not receive a permission prompt during
        // the critical first render. The /sell page only needs registration and
        // mileage to value a vehicle; location can be collected later in the
        // seller journey if it is actually required.
        if (pathname?.startsWith('/sell')) return

        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    if (request !== postcodeRequestRef.current) return
                    const loc = { lat: coords.latitude, lng: coords.longitude }
                    setLocation({ ...loc, postcode: null, source: 'geo' })
                    try {
                        localStorage.setItem(GEO_KEY, JSON.stringify({ ...loc, expiresAt: Date.now() + CACHE_TTL }))
                    } catch { /* ignore */ }
                },
                () => { /* denied — UI in consumer components handles this */ },
                { timeout: 5000, maximumAge: CACHE_TTL }
            )
        }
    }, [pathname])

    useEffect(() => () => {
        ++postcodeRequestRef.current
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }, [])

    const setPostcode = (pc: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        const request = ++postcodeRequestRef.current
        const postcode = pc.trim().toUpperCase()
        // A changed/invalid postcode must never keep searching around the old one.
        setLocation({ lat: null, lng: null, postcode, source: 'postcode' })
        try {
            localStorage.removeItem(PC_KEY)
            localStorage.removeItem(GEO_KEY)
        } catch { /* storage unavailable */ }
        debounceRef.current = setTimeout(async () => {
            const coords = postcode ? await geocodePostcode(postcode) : null
            if (request !== postcodeRequestRef.current) return
            if (coords) {
                setLocation({ ...coords, postcode, source: 'postcode' })
                try { localStorage.setItem(PC_KEY, postcode) } catch { /* ignore */ }
            }
        }, 600)
    }

    return (
        <LocationContext.Provider value={{ location, setPostcode }}>
            {children}
        </LocationContext.Provider>
    )
}

export function useLocation() {
    return useContext(LocationContext)
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s/g, ''))}`)
        if (!res.ok) return null
        const json = await res.json()
        return { lat: json.result.latitude, lng: json.result.longitude }
    } catch { return null }
}
