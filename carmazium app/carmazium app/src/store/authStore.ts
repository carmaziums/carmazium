import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'czm_onboarding_complete';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  location?: string | null;
  isAddressVerified?: boolean;
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
    isAddressVerified?: boolean;
  };
}

interface AuthState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  pendingEmailVerification: boolean;
  user: User | null;
  isLoading: boolean;
  role: 'buyer' | 'seller' | 'dealer';

  completeOnboarding: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setRole: (role: 'buyer' | 'seller' | 'dealer') => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  pendingEmailVerification: false,
  user: null,
  isLoading: false,
  role: 'buyer' as 'buyer' | 'seller' | 'dealer',

  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1').catch(() => {});
    set({ hasCompletedOnboarding: true });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setRole: (role: 'buyer' | 'seller' | 'dealer') => set({ role }),

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
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
          set({
            isAuthenticated: true,
            pendingEmailVerification: false,
            role: mappedRole,
            user: {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName || null,
              lastName: profile.lastName || null,
              phone: profile.phone || null,
              profileImage: profile.profileImage || null,
              location: profile.location || null,
              isAddressVerified: profile.isAddressVerified || false,
            },
          });

          // Onboarding is complete if: the user has set a location (from any platform)
          // OR if they explicitly completed it on this device before
          const [storedFlag, profileLocation] = await Promise.all([
            SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null),
            Promise.resolve(profile.location || null),
          ]);
          const hasCompletedOnboarding = storedFlag === '1' || !!profileLocation;
          set({ hasCompletedOnboarding });
        }
      } else {
        set({ isAuthenticated: false, pendingEmailVerification: false, user: null });
      }
    } catch (err) {
      console.warn('Failed to initialize auth state:', err);
      // Also reset role: a failed init must never leave a stale 'dealer'
      // preview-toggle value in memory (it would otherwise survive into the
      // next login/signup attempt and contaminate persisted account data).
      set({ isAuthenticated: false, user: null, role: 'buyer' });
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

      if (error) throw error;

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
        set({
          isAuthenticated: true,
          role: mappedRole,
          user: {
            id: profile.id,
            email: profile.email,
            firstName: profile.firstName || null,
            lastName: profile.lastName || null,
            phone: profile.phone || null,
            profileImage: profile.profileImage || null,
            location: profile.location || null,
          },
        });

        const [storedFlag, profileLocation] = await Promise.all([
          SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null),
          Promise.resolve(profile.location || null),
        ]);
        const hasCompletedOnboarding = storedFlag === '1' || !!profileLocation;
        set({ hasCompletedOnboarding });
      }
    } catch (err) {
      // Reset role on a failed login too — see comment in initializeAuth's
      // catch block: a stale 'dealer' preview-toggle value must never survive
      // an interrupted auth flow into the next login/signup attempt.
      set({ isAuthenticated: false, user: null, role: 'buyer' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (email, password, fullName) => {
    set({ isLoading: true });
    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      // Brand-new accounts must ALWAYS be created as BUYER. Dealer status is an
      // elevated state granted only through a deliberate verification/onboarding
      // flow (see DealerOnboardingScreen / POST /users/elevate) — it must never
      // be inherited from `get().role`, which is just the local "preview as
      // dealer" demo toggle's leftover in-memory value. Reading that stale flag
      // here was writing `role: DEALER` straight into the database for fresh
      // signups, i.e. exactly the data-sanitization bug being fixed.
      const role = 'BUYER';

      // 1. Supabase Signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
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
            user: {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName || null,
              lastName: profile.lastName || null,
              phone: profile.phone || null,
              profileImage: profile.profileImage || null,
              location: profile.location || null,
              isAddressVerified: profile.isAddressVerified || false,
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
          role: 'buyer',
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
      set({ isAuthenticated: false, user: null, role: 'buyer' });
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
        hasCompletedOnboarding: false,
        isLoading: false,
      });
    }
  },
}));
