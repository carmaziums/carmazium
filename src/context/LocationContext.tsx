"use client"
import React, { createContext, useContext, useState, useEffect, useRef } from "react"

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

const GEO_KEY = 'carmazium_user_location'   // same key as useUserLocation hook
const PC_KEY  = 'carmazium_user_postcode'
const CACHE_TTL = 10 * 60 * 1000

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const [location, setLocation] = useState<LocationState>({
        lat: null, lng: null, postcode: null, source: null,
    })
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
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
                    if (coords) setLocation({ ...coords, postcode: pc, source: 'postcode' })
                })
                return
            }
        } catch { /* ignore */ }

        // 3. Browser geolocation
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
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
    }, [])

    const setPostcode = (pc: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            try { localStorage.setItem(PC_KEY, pc) } catch { /* ignore */ }
            const coords = await geocodePostcode(pc)
            if (coords) setLocation({ ...coords, postcode: pc, source: 'postcode' })
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
