"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com'

    const fetchProfile = async (userId: string, token: string) => {
        if (!token) {
            console.warn('fetchProfile: No token provided');
            setLoading(false);
            return;
        }

        try {
            console.log('Fetching profile for:', userId);
            const response = await fetch(`${API_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            if (response.ok) {
                const data = await response.json()
                setProfile(data)
            } else {
                console.error('Profile fetch failed:', response.status);

                if (response.status === 401) {
                    console.warn('Unauthorized - session invalid, signing out...');
                    // User has a valid Supabase token but backend rejected it (revoked/invalid)
                    // Force sign out to clear inconsistent state
                    // await supabase.auth.signOut();
                    // setUser(null);
                    // setProfile(null);
                    console.warn('Auto-logout disabled for debugging');
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false); // Ensure loading stops even on failure
        }
    }

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user && session.access_token) {
                fetchProfile(session.user.id, session.access_token)
            }
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setUser(session?.user ?? null)
            if (session?.user && session.access_token) {
                await fetchProfile(session.user.id, session.access_token)
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
        setUser(null)
        setProfile(null)
    }

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && session.access_token) {
            await fetchProfile(session.user.id, session.access_token)
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
