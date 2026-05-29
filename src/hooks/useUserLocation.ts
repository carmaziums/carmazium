"use client"

import { useState, useEffect } from 'react'

export interface UserLocation {
    lat: number
    lng: number
}

const CACHE_KEY = 'carmazium_user_location'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function useUserLocation(): { location: UserLocation | null; loading: boolean } {
    const [location, setLocation] = useState<UserLocation | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Serve from cache first for instant render
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (raw) {
                const cached = JSON.parse(raw)
                if (Date.now() < cached.expiresAt) {
                    setLocation({ lat: cached.lat, lng: cached.lng })
                    setLoading(false)
                    return
                }
            }
        } catch { /* ignore parse errors */ }

        if (!navigator?.geolocation) {
            setLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const loc: UserLocation = { lat: coords.latitude, lng: coords.longitude }
                setLocation(loc)
                setLoading(false)
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...loc, expiresAt: Date.now() + CACHE_TTL_MS }))
                } catch { /* ignore storage errors */ }
            },
            () => { setLoading(false) },
            { timeout: 5000, maximumAge: CACHE_TTL_MS }
        )
    }, [])

    return { location, loading }
}
