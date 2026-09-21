"use client"

import Script from "next/script"
import { analyticsEnabled } from "@/lib/analyticsEnv"

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim()

/**
 * Loads the CarMazium-owned Google Tag Manager container.
 *
 * GTM is the sole loader/configuration owner for the GA4 and Google Ads base
 * tags. GoogleAnalytics.tsx only sends application events and manual App
 * Router page views through the gtag/dataLayer interface established by
 * GoogleConsentMode; it does not load or configure a second Google tag.
 *
 * IMPORTANT: do not gate GTM on the cookie-consent "granted" state.
 * GoogleConsentMode sets Consent Mode v2 defaults to denied before this script
 * loads. Loading the Google-only container under those denied defaults lets
 * Google receive cookieless consent-mode signals and lets queued Google Ads
 * conversion commands be processed without enabling advertising or analytics
 * storage. If the visitor accepts, ConsentContext upgrades the consent state
 * to granted. If they reject, storage remains denied.
 *
 * Meta and TikTok remain independently consent-gated by their own components.
 */
export function GoogleTagManager() {
    if (!analyticsEnabled || !GTM_ID) return null

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
