import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Toast, useToast } from '../components/Toast';
import { useWatchlistStore } from '../store/watchlistStore';

export const GlobalToastContext = React.createContext<{
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'saved') => void;
}>({
  showToast: () => {},
});

export const GlobalToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { toast, show, hide } = useToast();

  // Watch for watchlist store changes to trigger toast
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
