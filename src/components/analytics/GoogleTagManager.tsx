"use client"

import Script from "next/script"
import { analyticsEnabled } from "@/lib/analyticsEnv"

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim()
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
const ADS_DESTINATION = ADS_ID && /^AW-\d+$/.test(ADS_ID) ? ADS_ID : null

/**
 * Loads the CarMazium-owned Google Tag Manager container.
 *
 * GTM is the sole base-tag loader. Its published Google tag currently
 * configures GA4 only; without registering the Ads destination, sending a
 * conversion event with send_to: AW-ID/LABEL is not reliable. Register the
 * Ads destination once through the existing gtag/dataLayer queue without
 * loading another gtag.js script or duplicating GA4 page views.
 * GoogleAnalytics.tsx continues to send application events and manual SPA
 * page views through the same gtag/dataLayer interface.
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
                    // Configure the Ads destination in the same consent-aware
                    // Google tag queue, without a second base-tag script.
                    ${ADS_DESTINATION ? `window.gtag('config', '${ADS_DESTINATION}', { send_page_view: false });` : ''}
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
