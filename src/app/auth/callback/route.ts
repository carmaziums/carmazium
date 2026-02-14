import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Handle errors from Supabase
    if (error) {
        console.error('Auth callback error:', error, errorDescription)
        return NextResponse.redirect(
            new URL(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
        )
    }

    // Handle email verification code
    if (code) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        })

        try {
            // Exchange the code for a session
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Error exchanging code for session:', exchangeError)
                return NextResponse.redirect(
                    new URL(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
                )
            }

            if (data.session && data.user) {
                // Ensure backend has the user (sync) so dashboard/supabase-session works.
                // Production (Vercel): set NEXT_PUBLIC_API_URL to your Render backend URL.
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com').replace(/\/$/, '')
                const meta = (data.user.user_metadata || {}) as Record<string, string>
                try {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 8000)
                    const res = await fetch(`${apiBase}/users/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: data.user.id,
                            email: data.user.email,
                            firstName: meta.first_name ?? meta.firstName,
                            lastName: meta.last_name ?? meta.lastName,
                            role: meta.role,
                        }),
                        signal: controller.signal,
                    })
                    clearTimeout(timeoutId)
                    if (!res.ok) {
                        console.error('Auth callback: sync returned', res.status, await res.text())
                    }
                } catch (syncErr) {
                    console.error('Auth callback: backend sync failed', syncErr)
                }

                // Check if email is verified
                if (data.user.email_confirmed_at) {
                    // Email verified - redirect to dashboard or onboarding
                    const redirectTo = requestUrl.searchParams.get('redirect_to') || '/dashboard'
                    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
                } else {
                    // Email not verified yet (shouldn't happen, but handle it)
                    return NextResponse.redirect(
                        new URL('/auth/onboarding?verified=false', requestUrl.origin)
                    )
                }
            }
        } catch (err: any) {
            console.error('Unexpected error in callback:', err)
            return NextResponse.redirect(
                new URL(`/auth/login?error=${encodeURIComponent(err.message || 'Verification failed')}`, requestUrl.origin)
            )
        }
    }

    // No code or error - redirect to login
    return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}
