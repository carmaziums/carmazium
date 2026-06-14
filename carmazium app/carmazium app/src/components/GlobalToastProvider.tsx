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
  const { isAuthenticated } = useAuthStore();

  // ── Watchlist toasts ──────────────────────────────────────────────────────────
  const savedIds = useWatchlistStore((s) => s.savedIds);
  const prevCount = React.useRef(savedIds.size);

  React.useEffect(() => {
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
        auth: { token },
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
