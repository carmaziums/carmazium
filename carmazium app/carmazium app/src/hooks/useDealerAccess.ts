import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DealerAccess,
  DealerPermission,
  getDealerAccess,
} from '../lib/dealerAccessApi';
import { useAuthStore } from '../store/authStore';

type AccessSnapshot = {
  userId: string | null;
  access: DealerAccess | null;
  loading: boolean;
  error: string | null;
};

export function useDealerAccess(enabled = true) {
  const userId = useAuthStore(s => s.user?.id ?? null);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const activeUserId = enabled && isAuthenticated ? userId : null;
  const requestEpoch = useRef(0);
  const [snapshot, setSnapshot] = useState<AccessSnapshot>({
    userId: null, access: null, loading: false, error: null,
  });

  const refresh = useCallback(async (force = false) => {
    const requestId = ++requestEpoch.current;
    if (!activeUserId) {
      setSnapshot({ userId: null, access: null, loading: false, error: null });
      return;
    }

    // Clear stale grants before a new identity/role check; do not show tools
    // using the previous user's cached permissions while loading.
    setSnapshot({ userId: activeUserId, access: null, loading: true, error: null });
    try {
      const access = await getDealerAccess(force, activeUserId);
      if (requestEpoch.current !== requestId
        || useAuthStore.getState().user?.id !== activeUserId
        || !useAuthStore.getState().isAuthenticated) return;
      setSnapshot({ userId: activeUserId, access, loading: false, error: null });
    } catch (err: any) {
      if (requestEpoch.current !== requestId) return;
      setSnapshot({
        userId: activeUserId, access: null, loading: false,
        error: err?.message || 'Unable to load dealership permissions.',
      });
    }
  }, [activeUserId]);

  useEffect(() => {
    void refresh();
    return () => { requestEpoch.current += 1; };
  }, [refresh]);

  const matchingIdentity = !!activeUserId && snapshot.userId === activeUserId;
  const access = matchingIdentity ? snapshot.access : null;
  const loading = enabled && (!activeUserId || !matchingIdentity || snapshot.loading);
  const error = matchingIdentity ? snapshot.error : null;
  const hasPermission = useCallback(
    (permission: DealerPermission) => !loading && !!access?.permissions?.includes(permission),
    [access, loading],
  );

  return { access, loading, error, hasPermission, refresh };
}
