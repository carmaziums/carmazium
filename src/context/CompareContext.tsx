"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { Listing } from "@/lib/listingApi"

interface CompareContextType {
    compareList: Listing[]
    addToCompare: (vehicle: Listing) => void
    removeFromCompare: (vehicleId: string) => void
    isInCompare: (vehicleId: string) => boolean
    toggleCompareDrawer: () => void
    isDrawerOpen: boolean
}

const CompareContext = createContext<CompareContextType | undefined>(undefined)

export function CompareProvider({ children }: { children: React.ReactNode }) {
    const [compareList, setCompareList] = useState<Listing[]>([])
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem("carmazium_compare")
        if (saved) {
            try {
                setCompareList(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to parse compare list", e)
            }
        }
    }, [])

    // Save to local storage whenever list changes
    useEffect(() => {
        localStorage.setItem("carmazium_compare", JSON.stringify(compareList))
    }, [compareList])

    const addToCompare = (vehicle: Listing) => {
        if (!compareList.some(v => v.id === vehicle.id)) {
            if (compareList.length >= 3) {
                setCompareList(prev => [...prev.slice(1), vehicle])
            } else {
                setCompareList(prev => [...prev, vehicle])
            }
        }
        setIsDrawerOpen(false) // Don't auto open drawer because we navigate instead
    }

    const removeFromCompare = (vehicleId: string) => {
        setCompareList(prev => prev.filter(v => v.id !== vehicleId))
    }

    const isInCompare = (vehicleId: string) => {
        return compareList.some(v => v.id === vehicleId)
    }

    const toggleCompareDrawer = () => setIsDrawerOpen(prev => !prev)

    return (
        <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, isInCompare, toggleCompareDrawer, isDrawerOpen }}>
            {children}
        </CompareContext.Provider>
    )
}

export function useCompare() {
    const context = useContext(CompareContext)
    if (context === undefined) {
        throw new Error("useCompare must be used within a CompareProvider")
    }
    return context
}
