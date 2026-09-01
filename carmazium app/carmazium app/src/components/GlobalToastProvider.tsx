import React from 'react';
import { io, Socket } from 'socket.io-client';
import { Toast, useToast } from '../components/Toast';
import { useWatchlistStore } from '../store/watchlistStore';
import { useAuthStore } from '../store/authStore';
import { getAccessToken } from '../lib/supabase';
import { AppNotification } from '../lib/notificationsApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

export const GlobalToastContext = React.createContext<{
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'saved') => void;
}>({
  showToast: () => {},
});

export const GlobalToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { toast, show, hide } = useToast();
  // Selector, not a whole-store subscription. This provider wraps RootNavigator,
  // so re-rendering it on unrelated auth-store writes propagates further than
  // anything else in the tree.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ── Watchlist toasts ──────────────────────────────────────────────────────────
  const savedIds = useWatchlistStore((s) => s.savedIds);
  const hydrateWatchlist = useWatchlistStore((s) => s.hydrateFromApi);
  const prevCount = React.useRef(savedIds.size);
  // While true, the savedIds-diff effect below updates its baseline silently
  // instead of toasting — otherwise the one-time hydration on app start
  // (0 -> N saved items) would fire a false "Vehicle saved to your
  // watchlist" toast on every cold start.
  const suppressToastRef = React.useRef(true);

  // One-time hydration on auth-ready so heart state on Home/Live/Search is
  // correct immediately after a cold start — previously hydrateFromApi() was
  // only called from the Watchlist/Saved screens themselves, so a heart
  // toggled before the last app close showed as unsaved until the user
  // happened to open the Watchlist tab.
  const hydratedOnceRef = React.useRef(false);
  React.useEffect(() => {
    if (!isAuthenticated || hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;
    hydrateWatchlist().finally(() => {
      suppressToastRef.current = false;
    });
  }, [isAuthenticated, hydrateWatchlist]);

  React.useEffect(() => {
    if (suppressToastRef.current) {
      prevCount.current = savedIds.size;
      return;
    }
    if (savedIds.size > prevCount.current) {
      show('Vehicle saved to your watchlist', 'saved');
    } else if (savedIds.size < prevCount.current) {
      show('Vehicle removed from watchlist', 'info');
    }
    prevCount.current = savedIds.size;
  }, [savedIds, show]);

  // ── /notifications Socket.IO subscription ─────────────────────────────────────
  const notifSocketRef = React.useRef<Socket | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect if user logs out
      if (notifSocketRef.current) {
        notifSocketRef.current.disconnect();
        notifSocketRef.current = null;
      }
      return;
    }

    // Guard: only create the socket once
    if (notifSocketRef.current) return;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const socket = io(`${API_URL}/notifications`, {
        // Function form re-fetches a fresh token on every reconnect attempt —
        // see ChatContext.tsx for why a plain-object `auth` goes stale.
        auth: (cb) => getAccessToken().then((t) => cb(t ? { token: t } : {})),
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      notifSocketRef.current = socket;

      socket.on('connect', () => {
        if (__DEV__) console.log('GlobalToast: /notifications socket connected');
      });

      socket.on('disconnect', () => {
        if (__DEV__) console.log('GlobalToast: /notifications socket disconnected');
      });

      // Listen for new notification events from the backend
      const handleNotification = (payload: Partial<AppNotification>) => {
        const message = payload.title ?? payload.message ?? 'New notification';
        show(message, 'info');
      };

      // Try the most likely event names (backend may use either)
      socket.on('notification:new', handleNotification);
      socket.on('notification', handleNotification);
    };

    connect();

    return () => {
      if (notifSocketRef.current) {
        notifSocketRef.current.disconnect();
        notifSocketRef.current = null;
      }
    };
  // Re-run when authentication state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <GlobalToastContext.Provider value={{ showToast: show }}>
      {children}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hide}
      />
    </GlobalToastContext.Provider>
  );
};
