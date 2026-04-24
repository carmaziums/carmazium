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
            const response = await apiClient<{ success: boolean; data: UserProfile }>('/users/me');
            setProfile(response.data);
        } catch (error: any) {
            // AUTH_REDIRECT: apiClient is already redirecting to login — swallow silently
            if (error.message === 'AUTH_REDIRECT') {
                setProfile(null);
                return;
            }
            console.error('Error fetching profile:', error);
            setProfile(null);

            if (error.message && !error.message.includes('Unauthorized')) {
                console.warn('Profile fetch failed - user may need to sync with backend');
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // Establish backend session then fetch profile (avoid 401s on protected routes)
        const bridgeThenProfile = async (token: string) => {
            try {
                await apiClient('/auth/supabase-session', {
                    method: 'POST',
                    body: JSON.stringify({ token }),
                });
            } catch (err: any) {
                // AUTH_REDIRECT: swallow silently — redirect is already in progress
                if (err?.message !== 'AUTH_REDIRECT') {
                    console.warn('Session bridge failed:', err?.message);
                }
                // Profile fetch via Bearer token may still work — continue
            }
            await fetchProfile();
        };

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const token = session?.access_token || null;
            setUser(session?.user ?? null);
            if (token) {
                localStorage.setItem('authToken', token);

                // If it's a password recovery flow, skip backend session bridge
                // Recovery tokens are restricted and will fail backend validation until password is reset
                if (typeof window !== 'undefined' && 
                   (window.location.hash.includes('type=recovery') || 
                    window.location.href.includes('reset-password'))) {
                    setLoading(false);
                    return;
                }

                bridgeThenProfile(token);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            const token = session?.access_token ?? null;
            setUser(session?.user ?? null);

            if (token) {
                localStorage.setItem('authToken', token);
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('authToken');
                setProfile(null);
                setLoading(false);
                return;
            }

            if (event === 'PASSWORD_RECOVERY') {
                // Supabase API rejects GET /user with recovery tokens
                // Skip the backend session bridge to avoid 401s, just let them reset their password
                setLoading(false);
                return;
            }

            // Always establish backend session on sign-in or token refresh, then fetch profile
            if (session?.user && token) {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    await bridgeThenProfile(token);
                } else {
                    await fetchProfile();
                }
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

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
