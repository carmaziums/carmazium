import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables in Expo config.');
}

// Supabase persists the whole session (access + refresh tokens, expiry, token_type,
// AND the full `user` object incl. metadata) as one JSON blob under one key. Storing
// all of that in SecureStore routinely exceeds its ~2048-byte soft limit (the observed
// "Value being stored in SecureStore is larger than 2048 bytes" warning) — a real
// reliability risk on older Android (mobile-audit.md W9). Split it: only the two
// actual secrets go in SecureStore; everything else (expiry, user object) goes in
// AsyncStorage. Supabase itself only ever sees the combined getItem/setItem/removeItem
// interface, never the split.
const SECURE_SESSION_FIELDS = ['access_token', 'refresh_token'] as const;

const hybridStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const [securePart, restPart] = await Promise.all([
      SecureStore.getItemAsync(key),
      AsyncStorage.getItem(key),
    ]);
    if (!securePart && !restPart) return null;
    try {
      const secure = securePart ? JSON.parse(securePart) : {};
      const rest = restPart ? JSON.parse(restPart) : {};
      return JSON.stringify({ ...rest, ...secure });
    } catch {
      // Corrupt half — fall back to whichever part is still valid rather than
      // failing the whole session read.
      return restPart ?? securePart ?? null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value);
      const secure: Record<string, unknown> = {};
      const rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if ((SECURE_SESSION_FIELDS as readonly string[]).includes(k)) secure[k] = v;
        else rest[k] = v;
      }
      await Promise.all([
        SecureStore.setItemAsync(key, JSON.stringify(secure)),
        AsyncStorage.setItem(key, JSON.stringify(rest)),
      ]);
    } catch {
      // Not JSON (shouldn't happen for Supabase's session blob) — keep prior behavior.
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: hybridStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  }
);

/**
 * Retrieves the current access token from the active Supabase session.
 * @returns The JWT access token string or null if unauthenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.warn('Failed to retrieve Supabase session access token:', error);
    return null;
  }
}
