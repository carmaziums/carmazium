import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import * as SecureStore from 'expo-secure-store';

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
  // The real, backend-sourced account role — unlike `role`, this is never
  // touched by setRole()'s "preview as buyer" toggle (DealerProfileScreen's
  // "VIEW MY PROFILE"). Screens that need to know whether the underlying
  // account actually is a dealer/seller (not just how it's currently being
  // previewed) must read this instead of `role`
  // (mobile-production-readiness-plan.md F38 — a dealer previewing as buyer
  // could no longer be told apart from a real buyer using `role` alone).
  accountRole: 'buyer' | 'seller' | 'dealer';

  completeOnboarding: () => Promise<void>;
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
      set({ isLoading: false });
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
      });
    }
  },
}));
