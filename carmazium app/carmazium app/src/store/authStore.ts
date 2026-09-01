import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import * as SecureStore from 'expo-secure-store';
import { setAuthRedirectHandler, resetAuthRedirectLatch } from '../lib/authEvents';
import { navigationRef } from '../lib/navigationRef';

/** Post-signup wizard only: name -> verify -> postcode -> preferences.
 *  Key deliberately unchanged so existing installs that already have it are not
 *  re-prompted (OQ-3). */
const ONBOARDING_KEY = 'czm_onboarding_complete';
/** Pre-auth marketing carousel only. Separate key because the carousel used to
 *  write ONBOARDING_KEY: a signed-out user tapping through three marketing
 *  slides thereby marked the post-signup wizard complete, so after signing up
 *  they were never asked for their name, postcode or preferences (AUTH-003).
 *  Absent on existing installs, which correctly means "not seen yet" — the
 *  worst case is one extra viewing of the carousel, never a skipped wizard. */
const INTRO_SEEN_KEY = 'czm_intro_seen';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  location?: string | null;
  /** Mandatory on the backend since 53c5acca, but accounts created before that
   *  can still be missing it — LocationPromptSheet exists to collect it. */
  postcode?: string | null;
  isAddressVerified?: boolean;
  isVerified?: boolean; // true if dealer KYC approved
  /**
   * True when this user is active staff on someone else's verified dealership.
   * Such a user has no dealerProfile of their own, so `isVerified` is false for
   * them — gating dealer features on `isVerified` alone would lock out every
   * employee of a verified dealer. Web accounts for this the same way
   * (dashboard/dealer/layout.tsx: `isVerifiedDealer = dealerProfile.isVerified
   * || isStaffMember`).
   */
  isDealerStaff?: boolean;
}

interface UserProfileResponse {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImage?: string;
    location?: string;
    postcode?: string;
    isAddressVerified?: boolean;
    dealerProfile?: {
      isVerified?: boolean;
    };
    /** Active memberships only — the backend filters on isActive
     *  (users.service.ts getProfile). */
    dealerStaffMemberships?: unknown[];
  };
}

interface AuthState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  pendingEmailVerification: boolean;
  user: User | null;
  isLoading: boolean;
  role: 'buyer' | 'seller' | 'dealer';
  /** False until initializeAuth has finished once. RootNavigator must not
   *  decide which stack to show before this is true, or a signed-in user
   *  sees the Login screen flash while the session is still being restored
   *  (AUTH-035). `isLoading` cannot serve this purpose: it starts false, so
   *  there is a window before initializeAuth runs where both it and
   *  isAuthenticated are false and the app looks signed out. */
  authInitialized: boolean;
  /** Where to send the user once they sign back in — captured at the moment
   *  the session died, so an expiry does not silently dump them at the root
   *  of the app having lost what they were looking at (AUTH-034). Web does
   *  this with `?redirect=`. */
  postLoginRedirect: { name: string; params?: object } | null;
  // The real, backend-sourced account role — unlike `role`, this is never
  // touched by setRole()'s "preview as buyer" toggle (DealerProfileScreen's
  // "VIEW MY PROFILE"). Screens that need to know whether the underlying
  // account actually is a dealer/seller (not just how it's currently being
  // previewed) must read this instead of `role`
  // (mobile-production-readiness-plan.md F38 — a dealer previewing as buyer
  // could no longer be told apart from a real buyer using `role` alone).
  accountRole: 'buyer' | 'seller' | 'dealer';

  completeOnboarding: () => Promise<void>;
  /** Tear down the local session without asking the backend — the session is
   *  already gone, which is why we are here. Called from apiClient's 401
   *  path via authEvents (AUTH-014 / OQ-6). */
  forceLogout: () => Promise<void>;
  /** Subscribe to Supabase auth changes for the life of the app (AUTH-013).
   *  Returns an unsubscribe function. */
  subscribeToAuthChanges: () => () => void;
  consumePostLoginRedirect: () => { name: string; params?: object } | null;
  /** Marks the pre-auth carousel as seen. Deliberately NOT completeOnboarding —
   *  see INTRO_SEEN_KEY. */
  completeIntro: () => Promise<void>;
  hasSeenIntro: boolean;
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, role?: 'BUYER' | 'DEALER') => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setRole: (role: 'buyer' | 'seller' | 'dealer') => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  authInitialized: false,
  postLoginRedirect: null,
  hasCompletedOnboarding: false,
  // Starts false and is hydrated by initializeAuth. A fresh install has not
  // seen the carousel; an install that has will skip it after that first read.
  hasSeenIntro: false,
  pendingEmailVerification: false,
  user: null,
  isLoading: false,
  role: 'buyer' as 'buyer' | 'seller' | 'dealer',
  accountRole: 'buyer' as 'buyer' | 'seller' | 'dealer',

  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1').catch(() => {});
    set({ hasCompletedOnboarding: true });
  },

  completeIntro: async () => {
    await SecureStore.setItemAsync(INTRO_SEEN_KEY, '1').catch(() => {});
    set({ hasSeenIntro: true });
  },

  forceLogout: async () => {
    // Already signed out — nothing to tear down, and navigating would yank a
    // user who is legitimately sitting on the Login screen.
    if (!get().isAuthenticated) return;

    // Remember where they were before the stacks swap. getCurrentRoute() is
    // read now because RootNavigator is about to unmount the whole Main stack.
    let target: { name: string; params?: object } | null = null;
    try {
      if (navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        // Auth screens are never a sensible destination to return to.
        if (route?.name && !['Login', 'Signup', 'Onboarding', 'ForgotPassword', 'ResetPassword'].includes(route.name)) {
          target = { name: route.name, params: route.params as object | undefined };
        }
      }
    } catch {
      // Navigation not ready — losing the destination is acceptable; failing
      // to sign the user out is not.
    }

    // Deliberately no POST /auth/logout: the session this would authenticate
    // with is the one that just failed. Supabase signOut is still worth doing
    // so the dead refresh token is cleared from SecureStore rather than being
    // retried on next launch.
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline or already invalid — the local reset below is what matters.
    }

    set({
      isAuthenticated: false,
      pendingEmailVerification: false,
      user: null,
      role: 'buyer',
      accountRole: 'buyer',
      hasCompletedOnboarding: false,
      isLoading: false,
      postLoginRedirect: target,
    });
  },

  consumePostLoginRedirect: () => {
    const target = get().postLoginRedirect;
    if (target) set({ postLoginRedirect: null });
    return target;
  },

  subscribeToAuthChanges: () => {
    // The only app-wide subscription (AUTH-013). Mobile previously had none:
    // the sole subscriber repo-wide was VerifyEmailScreen, scoped to SIGNED_IN
    // and alive only while that screen was mounted — so a remote sign-out or a
    // failed token refresh was never observed anywhere else.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const state = get();

      if (event === 'SIGNED_OUT') {
        // Fired by a remote sign-out, or by our own logout()/forceLogout().
        // Guarded so it is a no-op in the latter case rather than a second
        // teardown racing the first.
        if (state.isAuthenticated) await get().forceLogout();
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        // Recovery tokens are restricted; bridging them to the backend 401s.
        // Web skips the bridge for exactly this reason (AuthContext.tsx:124-129).
        // Routing to the reset screen is already handled by App.tsx's deep-link
        // branch, so this only needs to not make things worse.
        return;
      }

      if (event === 'SIGNED_IN') {
        resetAuthRedirectLatch();
        // VerifyEmailScreen runs its own SIGNED_IN handler so it can show a
        // spinner while the account is confirmed. Standing aside here avoids
        // two initializeAuth() calls racing over the same profile fetch.
        if (state.pendingEmailVerification) return;
        if (!state.isAuthenticated) await get().initializeAuth();
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        // The backend session outlives a token refresh, so there is nothing to
        // re-bridge in the normal case. The one case worth catching is a
        // refresh arriving while local state thinks it is signed out — a cold
        // restore that lost the race — where rehydrating is right.
        resetAuthRedirectLatch();
        if (session?.access_token && !state.isAuthenticated) await get().initializeAuth();
        return;
      }
    });

    return () => subscription.unsubscribe();
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setRole: (role: 'buyer' | 'seller' | 'dealer') => set({ role }),
  updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : state.user })),

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      // Read first and unconditionally: the carousel gate matters precisely
      // when there is no session, which is the branch that returns early below.
      const introSeen = await SecureStore.getItemAsync(INTRO_SEEN_KEY).catch(() => null);
      set({ hasSeenIntro: introSeen === '1' });

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && session.access_token) {
        // Bridge the session with NestJS backend
        try {
          await apiClient('/auth/supabase-session', {
            method: 'POST',
            body: JSON.stringify({ token: session.access_token }),
          });
        } catch (bridgeErr) {
          console.warn('Backend session bridge failed on init:', bridgeErr);
        }

        // Fetch user profile info
        const response = await apiClient<UserProfileResponse>('/users/me');
        if (response.success && response.data) {
          const profile = response.data;
          const mappedRole = profile.role === 'DEALER' ? 'dealer' : profile.role === 'SELLER' ? 'seller' : 'buyer';

          // Onboarding is complete if: the user has set a location (from any platform)
          // OR if they explicitly completed it on this device before.
          // Read this BEFORE setting isAuthenticated so both flip in one atomic set()
          // and the RootNavigator never sees isAuthenticated:true + hasCompletedOnboarding:false.
          const [storedFlag, profileLocation] = await Promise.all([
            SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null),
            Promise.resolve(profile.location || null),
          ]);
          const hasCompletedOnboarding = storedFlag === '1' || !!profileLocation;

          set({
            isAuthenticated: true,
            pendingEmailVerification: false,
            hasCompletedOnboarding,
            role: mappedRole,
            accountRole: mappedRole,
            user: {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName || null,
              lastName: profile.lastName || null,
              phone: profile.phone || null,
              profileImage: profile.profileImage || null,
              location: profile.location || null,
              postcode: profile.postcode || null,
              isAddressVerified: profile.isAddressVerified || false,
              isVerified: profile.dealerProfile?.isVerified ?? false,
              isDealerStaff: (profile.dealerStaffMemberships?.length ?? 0) > 0,
            },
          });
        }
      } else {
        set({ isAuthenticated: false, pendingEmailVerification: false, user: null });
      }
    } catch (err) {
      console.warn('Failed to initialize auth state:', err);
      // Also reset role: a failed init must never leave a stale 'dealer'
      // preview-toggle value in memory (it would otherwise survive into the
      // next login/signup attempt and contaminate persisted account data).
      set({ isAuthenticated: false, user: null, role: 'buyer', accountRole: 'buyer' });
    } finally {
      // Always true afterwards, success or failure: the question this flag
      // answers is "have we looked?", not "did we find a session?"
      // (AUTH-035).
      set({ isLoading: false, authInitialized: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Supabase rejects unverified logins when email confirmation is required
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        set({
          isAuthenticated: false,
          pendingEmailVerification: true,
          user: { id: '', email, firstName: null, lastName: null },
        });
        return;
      }

      if (error) throw error;

      // Frontend guard: block unverified users when Supabase allows optional confirmation
      const supabaseUser = data.user;
      if (supabaseUser && !supabaseUser.email_confirmed_at) {
        await supabase.auth.signOut();
        set({
          isAuthenticated: false,
          pendingEmailVerification: true,
          user: {
            id: supabaseUser.id,
            email,
            firstName: supabaseUser.user_metadata?.first_name || null,
            lastName: supabaseUser.user_metadata?.last_name || null,
          },
        });
        return;
      }

      const session = data.session;
      if (!session) throw new Error('No session returned from Supabase');

      // Bridge session to NestJS backend
      await apiClient('/auth/supabase-session', {
        method: 'POST',
        body: JSON.stringify({ token: session.access_token }),
      });

      // Hydrate user profile from backend
      const response = await apiClient<UserProfileResponse>('/users/me');
      if (response.success && response.data) {
        const profile = response.data;
        const mappedRole = profile.role === 'DEALER' ? 'dealer' : profile.role === 'SELLER' ? 'seller' : 'buyer';
        const [storedFlag, profileLocation] = await Promise.all([
          SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null),
          Promise.resolve(profile.location || null),
        ]);
        const hasCompletedOnboarding = storedFlag === '1' || !!profileLocation;

        // A fresh session — re-arm the 401 latch so a later expiry in this
        // same app run is acted on rather than swallowed.
        resetAuthRedirectLatch();
        set({
          isAuthenticated: true,
          hasCompletedOnboarding,
          role: mappedRole,
          accountRole: mappedRole,
          user: {
            id: profile.id,
            email: profile.email,
            firstName: profile.firstName || null,
            lastName: profile.lastName || null,
            phone: profile.phone || null,
            profileImage: profile.profileImage || null,
            location: profile.location || null,
              postcode: profile.postcode || null,
            isAddressVerified: profile.isAddressVerified || false,
            isVerified: profile.dealerProfile?.isVerified ?? false,
              isDealerStaff: (profile.dealerStaffMemberships?.length ?? 0) > 0,
          },
        });
      }
    } catch (err) {
      // Reset role on a failed login too — see comment in initializeAuth's
      // catch block: a stale 'dealer' preview-toggle value must never survive
      // an interrupted auth flow into the next login/signup attempt.
      set({ isAuthenticated: false, user: null, role: 'buyer', accountRole: 'buyer' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (email, password, fullName, selectedRole = 'BUYER') => {
    set({ isLoading: true });
    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      // The role the user explicitly picked on the signup form — BUYER or
      // DEALER only (AUTH-005).
      //
      // Read the distinction carefully, because this used to be hardcoded to
      // 'BUYER' for a good reason. The original bug was reading `get().role`,
      // the local "preview as dealer" toggle, which silently wrote
      // `role: DEALER` into the database for people who never asked to be
      // dealers. An explicit choice made on this screen is the opposite of
      // that: it is the user's stated intent, it is one of exactly two values,
      // and it is never sourced from in-memory preview state. Do not
      // reintroduce `get().role` here.
      //
      // DEALER here sets the account role only. It does not confer
      // verification: `dealerProfile.isVerified` still comes from KYC, and
      // withDealerGate still blocks dealer screens until then. The backend
      // validates this against its own UserRole enum
      // (`users.service.ts:320`), so an unexpected value is dropped rather
      // than trusted.
      const role = selectedRole;

      // 1. Supabase Signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'carmazium://auth/callback',
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
          },
        },
      });

      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('No user returned from Supabase signup');

      // 2. Sync to NestJS backend
      try {
        await apiClient('/users/sync', {
          method: 'POST',
          body: JSON.stringify({
            id: user.id,
            email,
            firstName,
            lastName,
            role,
          }),
        });
      } catch (syncErr) {
        console.error('Backend sync failed:', syncErr);
      }

      // 3. Bridge session (if active immediately)
      const session = data.session;
      if (session) {
        await apiClient('/auth/supabase-session', {
          method: 'POST',
          body: JSON.stringify({ token: session.access_token }),
        });

        // 4. Hydrate profile
        const response = await apiClient<UserProfileResponse>('/users/me');
        if (response.success && response.data) {
          const profile = response.data;
          const mappedRole = profile.role === 'DEALER' ? 'dealer' : profile.role === 'SELLER' ? 'seller' : 'buyer';
          set({
            isAuthenticated: true,
            hasCompletedOnboarding: false,
            role: mappedRole,
            accountRole: mappedRole,
            user: {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName || null,
              lastName: profile.lastName || null,
              phone: profile.phone || null,
              profileImage: profile.profileImage || null,
              location: profile.location || null,
              postcode: profile.postcode || null,
              isAddressVerified: profile.isAddressVerified || false,
              isVerified: profile.dealerProfile?.isVerified ?? false,
              isDealerStaff: (profile.dealerStaffMemberships?.length ?? 0) > 0,
            },
          });
        }
      } else {
        // Email verification is required — Supabase won't return a session
        // until the user clicks the link. Do NOT set isAuthenticated: true
        // here; doing so causes ChatContext to fire API calls with no token,
        // producing 401 → AUTH_REDIRECT errors in the dev overlay.
        // Instead, route the user to the VerifyEmail screen and wait.
        set({
          isAuthenticated: false,
          pendingEmailVerification: true,
          hasCompletedOnboarding: false,
          // Reflect what they signed up as. Not load-bearing — nothing routes
          // on role while unauthenticated, and initializeAuth re-hydrates from
          // the backend once the email is verified — but leaving a DEALER
          // signup showing 'buyer' here is just a lie waiting to be read.
          role: selectedRole === 'DEALER' ? 'dealer' : 'buyer',
          accountRole: selectedRole === 'DEALER' ? 'dealer' : 'buyer',
          user: {
            id: user.id,
            email,
            firstName,
            lastName,
            location: null,
          },
        });
      }
    } catch (err) {
      // Reset role on failure too — an interrupted signup must never leave a
      // stale 'dealer' preview-toggle value sitting in memory to leak into
      // whatever auth flow the user lands on next.
      set({ isAuthenticated: false, user: null, role: 'buyer', accountRole: 'buyer' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // Destroy the backend session first — otherwise the stale "sid" cookie
      // outlives this user and the next login on this device inherits their
      // session (wrong role/profile) because SessionAuthGuard prefers the
      // cookie over the fresh Supabase bearer token.
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch (e) {
        console.warn('Backend logout failed:', e);
      }
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase logout error:', e);
    } finally {
      set({
        isAuthenticated: false,
        pendingEmailVerification: false,
        user: null,
        role: 'buyer',
        accountRole: 'buyer',
        hasCompletedOnboarding: false,
        isLoading: false,
        // A deliberate sign-out is not a session expiry: there is no
        // destination to come back to.
        postLoginRedirect: null,
      });
    }
  },
}));

// Wire apiClient's 401 path to the store. Done here, at module scope, so it
// is live before any screen can fire a request — and so apiClient never has
// to import this store (see lib/authEvents.ts on the require cycle).
setAuthRedirectHandler(() => {
  void useAuthStore.getState().forceLogout();
});
