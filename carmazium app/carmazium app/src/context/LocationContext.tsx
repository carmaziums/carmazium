import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// Buyer/delivery location remains postcode-first and does not request GPS.
// The seller listing wizard has a separate, explicitly user-triggered
// "Locate Me" action that requests foreground location only. Here we geocode
// the postcode client-side against postcodes.io so distance estimates work
// without device location; if geocoding fails we keep the postcode string and
// let the server validate it on POST /delivery-requests.

const STORAGE_KEY = 'carmazium.userLocation.v1';
const POSTCODE_LOOKUP_URL = 'https://api.postcodes.io/postcodes/';

export interface UserLocation {
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface LocationContextValue extends UserLocation {
  loading: boolean;
  /** Persist a new postcode. Attempts to geocode it via postcodes.io. */
  setPostcode: (postcode: string) => Promise<void>;
  /** Clear the stored postcode (used from Settings). */
  clear: () => Promise<void>;
}

const DEFAULT_VALUE: LocationContextValue = {
  postcode: null,
  latitude: null,
  longitude: null,
  loading: true,
  setPostcode: async () => {},
  clear: async () => {},
};

const LocationContext = createContext<LocationContextValue>(DEFAULT_VALUE);

function normalizePostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

async function geocode(postcode: string): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const res = await fetch(`${POSTCODE_LOOKUP_URL}${encodeURIComponent(postcode.replace(/\s+/g, ''))}`);
    if (!res.ok) return { latitude: null, longitude: null };
    const body = (await res.json()) as {
      result?: { latitude?: number | null; longitude?: number | null };
    };
    return {
      latitude: body?.result?.latitude ?? null,
      longitude: body?.result?.longitude ?? null,
    };
  } catch {
    return { latitude: null, longitude: null };
  }
}

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserLocation>({
    postcode: null,
    latitude: null,
    longitude: null,
  });
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);
  const persistenceRef = useRef(Promise.resolve());

  // Hydrate from SecureStore on mount so postcode + geocoded coords survive
  // an app relaunch — one of Stage 3's explicit acceptance criteria.
  useEffect(() => {
    let cancelled = false;
    const request = requestRef.current;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && raw && request === requestRef.current) {
          const parsed = JSON.parse(raw) as UserLocation;
          setState({
            postcode: parsed.postcode ?? null,
            latitude: typeof parsed.latitude === 'number' ? parsed.latitude : null,
            longitude: typeof parsed.longitude === 'number' ? parsed.longitude : null,
          });
        }
      } catch {
        // Non-fatal — treat as no stored location.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ++requestRef.current;
    };
  }, []);

  // Serialize storage writes so a slow old save cannot overwrite a newer postcode/clear.
  const persist = useCallback((next: UserLocation, request: number) => {
    persistenceRef.current = persistenceRef.current.catch(() => {}).then(async () => {
      if (request !== requestRef.current) return;
      if (next.postcode) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
      else await SecureStore.deleteItemAsync(STORAGE_KEY);
    }).catch(() => {});
    return persistenceRef.current;
  }, []);

  const setPostcode = useCallback(async (raw: string) => {
    const request = ++requestRef.current;
    const postcode = normalizePostcode(raw);
    const pending: UserLocation = { postcode: postcode || null, latitude: null, longitude: null };
    setState(pending);
    void persist(pending, request);
    const geo = postcode ? await geocode(postcode) : { latitude: null, longitude: null };
    if (request !== requestRef.current) return;
    const next: UserLocation = { postcode: postcode || null, ...geo };
    setState(next);
    await persist(next, request);
  }, [persist]);

  const clear = useCallback(async () => {
    const request = ++requestRef.current;
    const next: UserLocation = { postcode: null, latitude: null, longitude: null };
    setState(next);
    await persist(next, request);
  }, [persist]);

  const value = useMemo<LocationContextValue>(
    () => ({
      postcode: state.postcode,
      latitude: state.latitude,
      longitude: state.longitude,
      loading,
      setPostcode,
      clear,
    }),
    [state, loading, setPostcode, clear],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export function useLocation(): LocationContextValue {
  return useContext(LocationContext);
}
