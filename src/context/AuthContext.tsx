"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/apiClient'
import { User } from '@supabase/supabase-js'

interface UserProfile {
    id: string
    email: string
    role: string
    firstName?: string
    lastName?: string
    // Add other profile fields as needed
}

interface AuthContextType {
    user: User | null
    profile: UserProfile | null
    loading: boolean
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async () => {
        try {
            const data = await apiClient<UserProfile>('/users/me');
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            // apiClient already handles 401 removals and redirects
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const token = session?.access_token || null;
            if (token) {
                localStorage.setItem('authToken', token);
            }

            setUser(session?.user ?? null)
            if (session?.user && token) {
                fetchProfile()
            } else {
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const token = session?.access_token || null;
            setUser(session?.user ?? null)

            if (token) {
                localStorage.setItem('authToken', token);
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('authToken');
            }

            if (session?.user && token) {
                await fetchProfile()
            } else {
                setProfile(null)
            }
            setLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('authToken')
        setUser(null)
        setProfile(null)
    }

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && session.access_token) {
            await fetchProfile()
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
