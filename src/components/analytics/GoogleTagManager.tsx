"use client"

import Script from "next/script"
import { useConsent } from "@/context/ConsentContext"
import { analyticsEnabled } from "@/lib/analyticsEnv"

// .trim() guards against stray whitespace from a copy-pasted env var — an
// untrimmed ID silently breaks the container URL and GTM Preview then reports
// "no container found", same failure mode as the Meta pixel ID.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim()

/**
 * Loads the Google Tag Manager container.
 *
 * GTM runs alongside the directly-embedded GA4/Meta/TikTok tags rather than
 * replacing them — those keep working exactly as before. What GTM adds is a
 * place to attach tags to the app's own custom events (see lib/gtm.ts) without
 * needing a code change and redeploy for each one.
 *
 * No-op (renders nothing, loads no script) when NEXT_PUBLIC_GTM_ID is unset,
 * or until the visitor has accepted analytics/marketing cookies — see
 * ConsentContext.
 *
 * IMPORTANT: if you later move GA4 into GTM as a config tag, remove the
 * <GoogleAnalytics /> component from layout.tsx at the same time — running
 * both would double-count every pageview and conversion.
 */
export function GoogleTagManager() {
    const { granted } = useConsent()
    if (!analyticsEnabled || !GTM_ID || !granted) return null

    return (
        <>
            <Script id="gtm-init" strategy="afterInteractive">
                {`
                    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                    })(window,document,'script','dataLayer','${GTM_ID}');
                `}
            </Script>
            <noscript>
                <iframe
                    src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                    height="0"
                    width="0"
                    style={{ display: "none", visibility: "hidden" }}
                    title="Google Tag Manager"
                />
            </noscript>
        </>
    )
}
