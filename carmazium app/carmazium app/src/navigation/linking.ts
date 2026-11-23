import { getStateFromPath as getNavigationStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { nativeContentTarget } from '../lib/nativeContentLinks';
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
 *    and iOS associated domains are declared in app.json. The release must also
 *    verify the live domain associations against the actual signed binaries.
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

// The directory and service forms already share one native content-link mapper.
// Reuse it for incoming URLs, before the parameterised job-detail matcher can
// mistake the retired /services/jobs/new URL for a real job ID.
const serviceEntryPaths = new Set([
  '/auctions', '/services', '/auctions/how-it-works', '/auctions/browse',
  '/services/jobs/new', '/services/delivery', '/services/delivery/new',
  '/services/inspection', '/services/inspection/new', '/services/finance',
  '/finance', '/services/warranty', '/services/warranty/terms',
  '/dashboard/warranties', '/become-a-partner', '/contact',
]);

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes,

  filter: (url) => !isAuthCallbackUrl(url),

  getStateFromPath: (path, options) => {
    const pathname = ('/' + path.replace(/^\/+/, '')).split(/[?#]/)[0].replace(/\/$/, '');
    if (serviceEntryPaths.has(pathname)) {
      const target = nativeContentTarget('/' + path.replace(/^\/+/, ''));
      if (target) {
        const routes = target.name === 'Tabs' ? [{ ...target, path }] : [{ name: 'Tabs' }, { ...target, path }];
        // MainStackNavigator's existing screenLayout still applies GuestGate
        // to account-only routes, including CreateServiceJob.
        return { routes: [{ name: 'Main', state: { index: routes.length - 1, routes } }] };
      }
    }
    return getNavigationStateFromPath(path, options);
  },

  config: {
    screens: {
      // Only the Main stack is linkable. Routing an inbound URL into Auth would
      // either fight RootNavigator (which decides Auth vs Main from session
      // state, not from the URL) or drop a signed-out user onto a screen that
      // immediately 401s.
      Main: {
        initialRouteName: 'Tabs',
        screens: {
          // The invite link web sends is /auth/accept-invite?token=... — mapped
          // here so the token arrives as a route param instead of being pasted
          // by hand (AUTH-030).
          AcceptInvite: {
            path: 'auth/accept-invite',
            parse: { token: (token: string) => token },
          },
          // Public detail URLs hydrate through lightweight wrapper screens.
          // The wrappers fetch the authoritative listing/auction first, then reset
          // the stack to Tabs → Detail so cold-start back navigation stays native.
          VehicleDeepLink: {
            path: 'buy-cars/:slug',
            parse: { slug: (slug: string) => slug },
          },
          AuctionDeepLink: {
            path: 'auctions/live/:auctionId',
            parse: { auctionId: (auctionId: string) => auctionId },
          },
          Notifications: 'notifications',
          Messages: 'messages',
          Settings: 'settings',
          PartnerDashboard: 'dashboard/partner',
          ProviderOverview: 'dashboard/service',
          DealerSaved: 'dashboard/dealer/wishlist',
          DealerOffers: 'dashboard/dealer/offers',
          CustomerServiceJobs: 'services/jobs',
          CustomerServiceJobDetail: {
            path: 'services/jobs/:jobId',
            parse: { jobId: (jobId: string) => jobId },
          },
          // Account and email service-job alerts should open the original
          // native provider view, never a website fallback or hidden page.
          ProviderJobs: 'dashboard/service/jobs',
          ProviderJobDetail: {
            path: 'dashboard/service/jobs/:jobId',
            parse: { jobId: (jobId: string) => jobId },
          },
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
