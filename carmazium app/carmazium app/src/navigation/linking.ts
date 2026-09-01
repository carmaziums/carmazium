import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from './RootNavigator';

/**
 * React Navigation linking config (AUTH-020).
 *
 * `NavigationContainer` was previously mounted with `ref` and `theme` only — no
 * `linking` prop at all — so React Navigation never routed an inbound URL.
 * Every deep link was handled by one ad-hoc `expo-linking` listener in
 * `App.tsx` that matched Supabase auth tokens and nothing else, which is why
 * the dealer-staff invite needed a paste-the-link workaround (AUTH-030) and why
 * the OAuth return leg could never be traced end to end (AUTH-003).
 *
 * Two things this deliberately does NOT do:
 *
 * 1. **It does not handle the Supabase auth callback.** Those URLs carry tokens
 *    in a hash fragment or a `?code=`, need `setSession`/`exchangeCodeForSession`
 *    before any navigation makes sense, and have their own ordered branch list
 *    (AUTH-019). `App.tsx`'s listener keeps that job; `filter` below excludes
 *    those URLs so the two never both act on one link.
 *
 * 2. **It does not add `https://` support on its own.** `app.json` needs
 *    Android `data.host`/`pathPrefix` entries and iOS `associatedDomains`, plus
 *    an `apple-app-site-association` / `assetlinks.json` served from the domain,
 *    before `https://carmazium.com/...` opens the app. The Android intent filter
 *    is added here; **the iOS half and the server-side association files are
 *    not done** — see PROGRESS.md.
 */

const prefixes = [
  Linking.createURL('/'),
  'carmazium://',
  'https://carmazium.com',
  'https://www.carmazium.com',
];

/** Auth-callback URLs belong to App.tsx's handler, not to React Navigation. */
function isAuthCallbackUrl(url: string): boolean {
  return (
    url.includes('access_token=') ||
    url.includes('refresh_token=') ||
    url.includes('type=recovery') ||
    /[?&]code=/.test(url) ||
    url.includes('auth/callback')
  );
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes,

  filter: (url) => !isAuthCallbackUrl(url),

  config: {
    screens: {
      // Only the Main stack is linkable. Routing an inbound URL into Auth would
      // either fight RootNavigator (which decides Auth vs Main from session
      // state, not from the URL) or drop a signed-out user onto a screen that
      // immediately 401s.
      Main: {
        screens: {
          // The invite link web sends is /auth/accept-invite?token=... — mapped
          // here so the token arrives as a route param instead of being pasted
          // by hand (AUTH-030).
          AcceptInvite: {
            path: 'auth/accept-invite',
            parse: { token: (token: string) => token },
          },
          // NOT linkable, deliberately: VehicleDetail and LiveAuctionDetailed
          // both take a fully-hydrated `listing: CarListing` param, and a URL
          // can only supply a slug or id. Mapping them would hand the screen
          // `{ slug }` where it reads `route.params.listing`, i.e. a crash on
          // every inbound vehicle link. Making them linkable means first
          // giving them an id-only entry path that self-fetches — a real
          // change to two large screens, and out of scope here. Logged.
          Notifications: 'notifications',
          Messages: 'messages',
          Settings: 'settings',
          SellerListings: 'dashboard/listings',
          SellerAuctions: 'dashboard/auctions',
          BuyerOffers: 'dashboard/offers',
          BuyerBids: 'dashboard/bids',
          Earnings: 'dashboard/earnings',
        },
      },
    },
  },
};
