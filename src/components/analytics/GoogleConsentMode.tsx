import Script from "next/script"

/**
 * Google Consent Mode v2 defaults.
 *
 * WHY THIS EXISTS: Google Ads diagnostics reported "0% consent rate detected"
 * and flagged conversion reporting as impacted, because consent is required
 * for website conversions in the EEA/UK. The site previously just refused to
 * load gtag until the visitor accepted cookies, which means Google received no
 * consent signal at all — not "denied", but nothing. That reads as 0%, keeps
 * the Ads conversion goals stuck on "Misconfigured", and leaves Google unable
 * to model the conversions it can't observe.
 *
 * This declares every storage type as DENIED before any Google tag loads, so
 * the tag can load for everyone while storing nothing until the visitor
 * actually opts in. ConsentContext then sends `consent: update` the moment
 * they choose. That is the difference between "Google knows consent was
 * withheld" and "Google knows nothing", and it is what the diagnostic wants.
 *
 * ORDER IS LOAD-BEARING. This must be in the dataLayer before gtag.js
 * processes anything, hence `beforeInteractive` (injected into the initial
 * HTML) and hence its placement as the FIRST analytics component in
 * app/layout.tsx. Move it after the GoogleAnalytics component and the defaults
 * arrive too late to apply.
 *
 * What denial actually means here: no cookies, no advertising identifiers, no
 * user-level data. Google still receives a cookieless ping it can use for
 * modelled conversions, which is the entire point of Consent Mode and is the
 * mechanism Google itself prescribes for GDPR. If a stricter "no requests at
 * all before consent" posture is ever required, this component is the single
 * place to change it — but the Ads diagnostic will go back to 0%.
 *
 * Deliberately NOT a "use client" component: it renders no interactivity and
 * `beforeInteractive` only takes effect from the server-rendered root layout.
 */
export function GoogleConsentMode() {
    return (
        <Script id="google-consent-mode-default" strategy="beforeInteractive">
            {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;

                gtag('consent', 'default', {
                    'ad_storage': 'denied',
                    'ad_user_data': 'denied',
                    'ad_personalization': 'denied',
                    'analytics_storage': 'denied',
                    // Storage the site needs to function and to stay secure is
                    // not tracking and is not gated by the banner — the banner
                    // copy says as much ("one cookie keeps you logged in").
                    'functionality_storage': 'granted',
                    'security_storage': 'granted',
                    // Give ConsentContext a moment to read localStorage and send
                    // 'update' for a returning visitor who already accepted,
                    // before anything is reported under the denied defaults.
                    'wait_for_update': 500
                });

                // Strip ad identifiers from requests made while consent is
                // denied, and pass the click id through the URL instead of a
                // cookie so a conversion can still be attributed after an ad
                // click without storing anything.
                gtag('set', 'ads_data_redaction', true);
                gtag('set', 'url_passthrough', true);
            `}
        </Script>
    )
}
