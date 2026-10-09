"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"
import { useConsent } from "@/context/ConsentContext"
import { useAuth } from "@/context/AuthContext"
import { analyticsEnabled } from "@/lib/analyticsEnv"
import { hasTrackingConsent } from "@/lib/trackingConsent"

// .trim() guards against stray whitespace from a copy-pasted env var value —
// an untrimmed ID silently breaks the noscript pixel URL's query string and
// Meta's own Event Setup Tool then reports "pixel wasn't detected".
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

const META_STANDARD_EVENTS = new Set([
    "PageView",
    "ViewContent",
    "Search",
    "Lead",
    "CompleteRegistration",
    "Purchase",
])

// The historic implementation used Meta's generic Lead event for buyer vehicle
// enquiries as well as seller acquisition. The live seller campaign optimises
// for Lead, so that mixed buyer and seller intent into one optimisation signal.
// Keep existing call sites backwards-compatible while separating buyer actions
// into a custom event. Seller listing-start can then be the canonical Lead.
const VEHICLE_ENQUIRY_CATEGORIES = new Set([
    "vehicle_enquiry",
    "vehicle_chat_enquiry",
])

declare global {
    interface Window {
        fbq: ((...args: unknown[]) => void) & { loaded?: boolean }
        _fbq: unknown
    }
}

/**
 * Fire a Meta Pixel event from anywhere in the app.
 *
 * Meta standard events use `track`; CarMazium-specific lifecycle events use
 * `trackCustom`. Historic buyer-enquiry Lead calls are normalised to the
 * VehicleEnquiry custom event so seller campaigns are not trained on buyer
 * behaviour. The helper also re-checks the persisted consent decision on every
 * call. That matters when a visitor accepts cookies, loads the Pixel, and later
 * changes their preference to Reject All without a full page reload.
 */
type MetaEventOptions = {
    eventID?: string
}

export function trackMetaEvent(
    eventName: string,
    params?: Record<string, unknown>,
    options: MetaEventOptions = {},
) {
    if (!hasTrackingConsent()) return
    if (typeof window === "undefined" || typeof window.fbq !== "function") return

    const contentCategory = String(params?.content_category ?? "")
    const normalisedEventName =
        eventName === "Lead" && VEHICLE_ENQUIRY_CATEGORIES.has(contentCategory)
            ? "VehicleEnquiry"
            : eventName

    const command = META_STANDARD_EVENTS.has(normalisedEventName) ? "track" : "trackCustom"
    const hasParams = Boolean(params && Object.keys(params).length > 0)

    // Meta uses eventID to deduplicate a browser Pixel event against a future
    // server-side Conversions API copy of the same event. Supplying it now is
    // harmless for browser-only tracking and gives us a stable contract for
    // CAPI when the server token is provisioned.
    if (options.eventID) {
        window.fbq(command, normalisedEventName, hasParams ? params : {}, { eventID: options.eventID })
    } else if (hasParams) {
        window.fbq(command, normalisedEventName, params)
    } else {
        window.fbq(command, normalisedEventName)
    }
}


type MetaAdvancedMatchingData = {
    em?: string
    ph?: string
    fn?: string
    ln?: string
    zp?: string
    external_id?: string
}

function normaliseMetaEmail(value?: string | null): string | undefined {
    const email = value?.trim().toLowerCase()
    return email && email.includes("@") ? email : undefined
}

function normaliseMetaPhone(value?: string | null): string | undefined {
    const digits = value?.replace(/\D/g, "") ?? ""
    if (!digits) return undefined

    // CarMazium is a UK marketplace. Normalise domestic UK numbers to country
    // code form; leave already-international values intact.
    const normalised = digits.startsWith("0") ? `44${digits.slice(1)}` : digits
    return normalised.length >= 10 && normalised.length <= 15 ? normalised : undefined
}

function normaliseMetaName(value?: string | null): string | undefined {
    const name = value?.trim().toLowerCase()
    return name || undefined
}

function normaliseMetaPostcode(value?: string | null): string | undefined {
    const postcode = value?.replace(/\s+/g, "").trim().toLowerCase()
    return postcode || undefined
}

/**
 * Adds consented manual Advanced Matching data after the base Pixel exists.
 *
 * Keep this component under AuthProvider. The base Pixel deliberately remains
 * independent so anonymous visitors are still measured; once a signed-in user
 * profile is available we re-initialise the same Pixel once with matching
 * fields. Meta's own Pixel/GTM implementation supports this re-init pattern for
 * late-arriving Advanced Matching values.
 *
 * Raw account details are never copied into CarMazium analytics, GA4 or the
 * GTM dataLayer. They are handed only to the consent-gated Meta Pixel library,
 * which hashes Advanced Matching identifiers in the browser before transport.
 */
export function MetaAdvancedMatching() {
    const { granted } = useConsent()
    const { user, profile, loading } = useAuth()
    const appliedIdentity = useRef<string | null>(null)

    useEffect(() => {
        if (!analyticsEnabled || !META_PIXEL_ID || !granted || loading || !user) return

        const data: MetaAdvancedMatchingData = {
            em: normaliseMetaEmail(profile?.email || user.email),
            ph: normaliseMetaPhone(profile?.phone),
            fn: normaliseMetaName(profile?.firstName),
            ln: normaliseMetaName(profile?.lastName),
            zp: normaliseMetaPostcode(profile?.postcode),
            external_id: user.id,
        }

        if (!data.em && !data.ph && !data.external_id) return

        const identityKey = JSON.stringify(data)
        if (appliedIdentity.current === identityKey) return

        let attempts = 0
        const apply = () => {
            attempts += 1
            if (typeof window.fbq !== "function") return false
            window.fbq("init", META_PIXEL_ID, data)
            appliedIdentity.current = identityKey
            return true
        }

        if (apply()) return

        const timer = window.setInterval(() => {
            if (apply() || attempts >= 20) window.clearInterval(timer)
        }, 250)

        return () => window.clearInterval(timer)
    }, [
        granted,
        loading,
        user,
        profile?.email,
        profile?.phone,
        profile?.firstName,
        profile?.lastName,
        profile?.postcode,
    ])

    return null
}

function MetaPixelPageViewTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const lastUrl = useRef<string | null>(null)

    useEffect(() => {
        if (!META_PIXEL_ID || typeof window.fbq !== "function") return
        const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
        // Skip the very first render — the init script below already fires the
        // initial PageView, same as GoogleAnalytics's send_page_view: false split.
        if (lastUrl.current === null) {
            lastUrl.current = url
            return
        }
        if (url === lastUrl.current) return
        lastUrl.current = url
        window.fbq("track", "PageView")
    }, [pathname, searchParams])

    return null
}

/**
 * Loads the Meta (Facebook) Pixel base code and tracks App Router
 * client-side navigations as PageView events, since Next.js SPA routing
 * doesn't reload the page for fbq's own view to pick up automatically.
 * No-op (renders nothing, loads no script) when NEXT_PUBLIC_META_PIXEL_ID
 * is unset, or until the visitor has accepted analytics/marketing cookies —
 * see ConsentContext.
 */
export function MetaPixel() {
    const { granted } = useConsent()
    if (!analyticsEnabled || !META_PIXEL_ID || !granted) return null

    return (
        <>
            <Script id="meta-pixel-init" strategy="afterInteractive">
                {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    // CarMazium sends deliberate Meta events from useAnalytics.
                    // Disable Meta's automatic event classification so ordinary
                    // clicks/forms cannot be inferred as Lead and pollute seller
                    // campaign optimisation. This must run before fbq('init').
                    fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
                    fbq('init', '${META_PIXEL_ID}');
                    fbq('track', 'PageView');
                `}
            </Script>
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
            <Suspense fallback={null}>
                <MetaPixelPageViewTracker />
            </Suspense>
        </>
    )
}
