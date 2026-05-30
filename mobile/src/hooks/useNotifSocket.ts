import { useEffect } from 'react';
import { getNotifSocket } from '@/lib/socket';
import {
  scheduleLocalNotification,
  getNotificationPreferences,
  isQuietHours,
  getNotificationCategory,
} from '@/lib/notifications';
import { useNotificationsStore } from '@/store/notification.store';

/**
 * Subscribes to the /notifications Socket.IO namespace and bridges
 * incoming `notification:new` events to the Zustand store and the
 * local notification system (for foreground banners).
 *
 * Call once in the root layout after the user is authenticated.
 */
export function useNotifSocket(): void {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    getNotifSocket().then((socket) => {
      const handler = async (notification: any) => {
        // Update Zustand store — increments unread badge
        useNotificationsStore.getState().addNotification(notification);

        // Respect preferences before scheduling a banner
        const prefs = await getNotificationPreferences();

        if (prefs.quietHoursEnabled && isQuietHours(prefs.quietStart, prefs.quietEnd)) {
          return; // Quiet hours — suppress banner
        }

        const category = getNotificationCategory(notification.type ?? '');
        if (!prefs[category]) {
          return; // Category disabled — suppress banner
        }

        await scheduleLocalNotification(
          notification.title   ?? 'Carmazium',
          notification.message ?? '',
          {
            notifId: notification.id,
            type:    notification.type,
            link:    notification.data?.link ?? null,
          },
        );
      };

      socket.on('notification:new', handler);
      cleanup = () => socket.off('notification:new', handler);
    });

    return () => cleanup?.();
  }, []);
}
