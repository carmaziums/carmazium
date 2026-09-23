import { useCallback, useEffect, useState } from 'react';
import {
  DealerAccess,
  DealerPermission,
  getDealerAccess,
} from '../lib/dealerAccessApi';

export function useDealerAccess(enabled = true) {
  const [access, setAccess] = useState<DealerAccess | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setAccess(await getDealerAccess(force));
    } catch (err: any) {
      setAccess(null);
      setError(err?.message || 'Unable to load dealership permissions.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasPermission = useCallback(
    (permission: DealerPermission) => !!access?.permissions?.includes(permission),
    [access],
  );

  return { access, loading, error, hasPermission, refresh };
}
