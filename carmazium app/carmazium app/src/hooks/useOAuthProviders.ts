import { useEffect, useState } from 'react';

/**
 * Which social sign-in providers are switched on in Supabase. The Apple
 * button is hidden until Apple is enabled there, so customers never hit
 * "provider is not enabled"; it appears automatically once it is.
 */
type Providers = { google: boolean; apple: boolean };
let cached: Promise<Providers> | null = null;

function loadProviders(): Promise<Providers> {
  if (!cached) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    cached = (async () => {
      if (!url || !key) return { google: true, apple: false };
      try {
        const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
        const body = await res.json();
        return { google: body?.external?.google === true, apple: body?.external?.apple === true };
      } catch {
        cached = null; // retry next time
        return { google: true, apple: false };
      }
    })();
  }
  return cached;
}

export function useOAuthProviders(): Providers {
  const [providers, setProviders] = useState<Providers>({ google: true, apple: false });
  useEffect(() => {
    let alive = true;
    void loadProviders().then((p) => { if (alive) setProviders(p); });
    return () => { alive = false; };
  }, []);
  return providers;
}
