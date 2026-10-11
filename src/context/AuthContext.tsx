"use client"

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, getAccessToken, refreshAccessToken } from '@/lib/supabase'
import { isSessionTokenForUser } from '@/lib/supabaseSessionIdentity'
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
    location?: string
    postcode?: string
    preferences?: Record<string, any>
    dealerProfile?: any
    contractorProfile?: any
    dealerStaffMemberships?: Array<{
        id: string
        role: string
        dealerProfile: { id: string; companyName: string; isVerified: boolean; logo?: string | null }
    }>
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
    const bridgedTokenRef = useRef<string | null>(null)
    const bridgeInFlightRef = useRef<Promise<void> | null>(null)
    const activeUserIdRef = useRef<string | null>(null)
    const profileRecoveryInFlightRef = useRef<Promise<void> | null>(null)

    // Each profile response must belong to the current signed-in identity.
    // Switching accounts on another tab cannot show an old dealer's profile.
    const fetchProfile = async (expectedUserId: string | null = activeUserIdRef.current) => {
        try {
            const response = await apiClient<{ success: boolean; data: UserProfile }>('/users/me')
            if (activeUserIdRef.current === expectedUserId &&
                response.data?.id === expectedUserId) {
                setProfile(response.data)
            } else if (activeUserIdRef.current === expectedUserId) {
                console.warn('Authenticated user and backend profile do not match')
                setProfile(null)
            }
        } catch (error: any) {
            // The API redirects on a genuine authentication failure, not on a
            // temporary backend timeout. Never preserve another user's profile.
            if (activeUserIdRef.current === expectedUserId) {
                if (error?.message !== 'AUTH_REDIRECT') {
                    console.error('Error fetching profile:', error)
                }
                setProfile(null)
            }
        } finally {
            if (activeUserIdRef.current === expectedUserId) setLoading(false)
        }
    }

    useEffect(() => {
        let disposed = false
        const scheduled = new Set<ReturnType<typeof setTimeout>>()

        const bridgeThenProfile = (token: string, userId: string) => {
            // INITIAL_SESSION and SIGNED_IN may both fire at startup. Do not
            // race /users/me ahead of the cookie bridge or duplicate the bridge.
            if (bridgedTokenRef.current === token && bridgeInFlightRef.current) {
                return bridgeInFlightRef.current
            }
            if (bridgedTokenRef.current === token) {
                return fetchProfile(userId)
            }
            bridgedTokenRef.current = token

            const work = (async () => {
                try {
                    await apiClient('/auth/supabase-session', {
                        method: 'POST',
                        body: JSON.stringify({ token }),
                    })
                } catch (err: any) {
                    // Do not treat a failed cookie bridge as successful. Otherwise
                    // later auth events keep skipping the bridge even after the API
                    // recovers, and the signed-in user stays without a profile.
                    if (bridgedTokenRef.current === token && activeUserIdRef.current === userId) {
                        bridgedTokenRef.current = null
                    }
                    if (err?.message !== 'AUTH_REDIRECT') {
                        console.warn('Session bridge failed:', err?.message)
                    }
                    // /users/me can independently authenticate with the bearer
                    // token. A slow backend should display retry, not a spinner.
                }
                if (!disposed && activeUserIdRef.current === userId) {
                    await fetchProfile(userId)
                }
            })()

            bridgeInFlightRef.current = work
            void work.finally(() => {
                if (bridgeInFlightRef.current === work) {
                    bridgeInFlightRef.current = null
                }
            })
            return work
        }

        const isRecoveryRoute = () =>
            window.location.hash.includes('type=recovery')
            || window.location.pathname.includes('reset-password')

        const applySession = (event: string, session: { access_token: string; user: User } | null) => {
            if (disposed) return
            const token = session?.access_token ?? null
            const userId = session?.user?.id ?? null
            const previousUserId = activeUserIdRef.current
            activeUserIdRef.current = userId
            setUser(session?.user ?? null)

            if (!token || !userId) {
                if (event === 'SIGNED_OUT') {
                    bridgedTokenRef.current = null
                    bridgeInFlightRef.current = null
                }
                setProfile(null)
                setLoading(false)
                return
            }

            if (event === 'PASSWORD_RECOVERY' || isRecoveryRoute()) {
                setLoading(false)
                return
            }

            if (previousUserId && previousUserId !== userId) {
                bridgedTokenRef.current = null
                bridgeInFlightRef.current = null
                setProfile(null)
                setLoading(true)
            }

            if (event === 'TOKEN_REFRESHED' && bridgedTokenRef.current) {
                // A refreshed JWT doesn't change backend identity/role.
                // The bearer token is automatically read by getAccessToken().
                return
            }
            void bridgeThenProfile(token, userId)
        }

        // Supabase holds an auth lock when it invokes onAuthStateChange.
        // Never await apiClient/getSession/refreshSession inside this callback:
        // the SDK's auth lock can deadlock and leave desktop on the spinner.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const timer = setTimeout(() => {
                scheduled.delete(timer)
                applySession(event, session)
            }, 0)
            scheduled.add(timer)
        })

        // Keep a cold-start fallback for browsers that do not deliver the
        // INITIAL_SESSION event promptly (e.g. a blocked storage/auth SDK).
        // After the cap, route guards show their safe retry/login UI.
        const watchdog = setTimeout(() => {
            if (!disposed) setLoading(false)
        }, 18000)

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!disposed) applySession('INITIAL_SESSION', session)
        }).catch((error) => {
            if (!disposed) {
                console.warn('Unable to initialize browser auth session:', error)
                setLoading(false)
            }
        })

        return () => {
            disposed = true
            clearTimeout(watchdog)
            for (const timer of scheduled) clearTimeout(timer)
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
        // Destroy the backend session first so the sid cookie is invalidated.
        // Must happen before supabase.auth.signOut() while the token is still valid.
        try {
            await apiClient('/auth/logout', { method: 'POST' });
        } catch {
            // Best-effort — proceed with sign-out even if the backend call fails
        }
        await supabase.auth.signOut()
        // Clean up any legacy authToken key that older sessions may have written
        localStorage.removeItem('authToken')
        bridgedTokenRef.current = null
        bridgeInFlightRef.current = null
        activeUserIdRef.current = null
        setUser(null)
        setProfile(null)
    }

    const refreshProfile = async () => {
        const expectedUserId = activeUserIdRef.current
        if (!expectedUserId) return

        // Normal settings/profile refreshes do not need to create a new session.
        // Only a signed-in user with an unavailable profile needs recovery.
        if (profile?.id === expectedUserId) {
            await fetchProfile(expectedUserId)
            return
        }
        if (profileRecoveryInFlightRef.current) {
            await profileRecoveryInFlightRef.current
            return
        }

        // The prior retry button merely called /users/me again. When the
        // initial /auth/supabase-session failed (or its cookie belonged to a
        // previous account), that could never repair the session. A user click
        // now explicitly re-bridges first, then fetches the verified profile.
        // Avoid directly awaiting the Supabase SDK session getter: its auth
        // lock can stall browser startup. Both token helpers are time-bounded.
        const recovery = (async () => {
            let token = await getAccessToken()
            if (!token || !isSessionTokenForUser(token, expectedUserId)) {
                token = await refreshAccessToken()
            }

            const bridgeOnce = async (candidate: string): Promise<'ok' | 'unauthorized' | 'unavailable'> => {
                try {
                    await apiClient('/auth/supabase-session', {
                        method: 'POST',
                        body: JSON.stringify({ token: candidate }),
                    })
                    if (activeUserIdRef.current === expectedUserId) bridgedTokenRef.current = candidate
                    return 'ok'
                } catch (err: any) {
                    if (activeUserIdRef.current === expectedUserId) bridgedTokenRef.current = null
                    if (err?.message === 'AUTH_BRIDGE_UNAUTHORIZED') return 'unauthorized'
                    // A real network outage is still possible; the subsequent
                    // read can work through the independent bearer-token guard.
                    console.warn('Account session recovery was unavailable:', err?.message)
                    return 'unavailable'
                }
            }

            if (token && isSessionTokenForUser(token, expectedUserId) &&
                activeUserIdRef.current === expectedUserId) {
                const bridgeResult = await bridgeOnce(token)
                if (bridgeResult === 'unauthorized' && activeUserIdRef.current === expectedUserId) {
                    // A token can be locally unexpired but already invalidated
                    // at Supabase. Refresh once, not an unlimited auth loop.
                    const refreshed = await refreshAccessToken()
                    if (refreshed && isSessionTokenForUser(refreshed, expectedUserId)) {
                        await bridgeOnce(refreshed)
                    }
                }
            }
            if (activeUserIdRef.current === expectedUserId) {
                await fetchProfile(expectedUserId)
            }
        })()
        profileRecoveryInFlightRef.current = recovery
        try {
            await recovery
        } finally {
            if (profileRecoveryInFlightRef.current === recovery) {
                profileRecoveryInFlightRef.current = null
            }
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
