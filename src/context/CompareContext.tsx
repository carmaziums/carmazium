"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface Vehicle {
    id: string
    title: string
    price: string
    image: string
    specs: {
        year: string
        mileage: string
        engine: string
        transmission: string
        doors: string
        seats: string
    }
}

interface CompareContextType {
    compareList: Vehicle[]
    addToCompare: (vehicle: Vehicle) => void
    removeFromCompare: (vehicleId: string) => void
    isInCompare: (vehicleId: string) => boolean
    toggleCompareDrawer: () => void
    isDrawerOpen: boolean
}

const CompareContext = createContext<CompareContextType | undefined>(undefined)

export function CompareProvider({ children }: { children: React.ReactNode }) {
    const [compareList, setCompareList] = useState<Vehicle[]>([])
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

    const addToCompare = (vehicle: Vehicle) => {
        if (compareList.length >= 2) {
            // Basic replacement logic: Remove first, add new
            // Or we could alert. For premium feel, maybe a toast "Comparison full - replacing first item"
            // For now, let's just replace the first one if full to keep it frictionless
            setCompareList(prev => [...prev.slice(1), vehicle])
        } else {
            setCompareList(prev => [...prev, vehicle])
        }
        setIsDrawerOpen(true) // Auto open drawer to show it worked
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
