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
    phone?: string
    profileImage?: string
    dealerProfile?: any
    contractorProfile?: any
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
        } catch (error: any) {
            console.error('Error fetching profile:', error);
            setProfile(null); // Explicitly set to null on failure

            // If it's not a 401 (which is handled by apiClient), 
            // the user might not be synced with the backend yet
            if (error.message && !error.message.includes('Unauthorized')) {
                console.warn('Profile fetch failed - user may need to sync with backend');
            }
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

                // Ensure backend session exists (for SSR/cookies)
                apiClient('/auth/supabase-session', {
                    method: 'POST',
                    body: JSON.stringify({ token }),
                }).catch(err => console.warn('Session restore bridge failed', err));
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

            // Handle email verification events
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Check if email was just verified
                if (session?.user?.email_confirmed_at && session?.user && token) {
                    // Ensure backend session exists after verification
                    try {
                        await apiClient('/auth/supabase-session', {
                            method: 'POST',
                            body: JSON.stringify({ token }),
                        })
                    } catch (err) {
                        console.warn('Session bridge failed after verification:', err)
                    }
                }
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
