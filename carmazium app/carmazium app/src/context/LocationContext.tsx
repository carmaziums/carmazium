import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// The mobile app doesn't request device geolocation — the prompt was to
// skip expo-location and let buyers type a postcode instead. We geocode
// the postcode client-side against postcodes.io so haversine distance
// estimates still work; if the geocode fails we keep the postcode string
// on record and let the server validate on POST /delivery-requests.

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

  // Hydrate from SecureStore on mount so postcode + geocoded coords survive
  // an app relaunch — one of Stage 3's explicit acceptance criteria.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && raw) {
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
    };
  }, []);

  const persist = useCallback(async (next: UserLocation) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal — user just won't have persistence.
    }
  }, []);

  const setPostcode = useCallback(
    async (raw: string) => {
      const postcode = normalizePostcode(raw);
      if (!postcode) return;
      const geo = await geocode(postcode);
      const next: UserLocation = {
        postcode,
        latitude: geo.latitude,
        longitude: geo.longitude,
      };
      setState(next);
      await persist(next);
    },
    [persist],
  );

  const clear = useCallback(async () => {
    const next: UserLocation = { postcode: null, latitude: null, longitude: null };
    setState(next);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch {
      // Non-fatal.
    }
  }, []);

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
