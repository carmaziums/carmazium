import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// Imported only as a type to avoid the circular module-level reference that
// caused "Cannot access NotificationsGateway before initialization" at startup.
import type { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    private readonly expo = new Expo();
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly moduleRef: ModuleRef,
    ) { }

    // Lazily resolved to break the circular import at class-definition time.
    private get gateway(): NotificationsGateway {
        return this.moduleRef.get('NotificationsGateway', { strict: false });
    }

    // Maps a notification's `type` string to the specific per-event toggle key
    // NotificationSettingsScreen.tsx saves under preferences.notifications.*.
    // Types with no entry here (chat messages, payments, delivery, KYC, admin
    // actions, etc.) were never meant to be individually gated by that screen
    // — only these "can get noisy" categories have dedicated toggles.
    private static readonly TYPE_PREF_KEY: Record<string, string> = {
        OUTBID: 'outbid',
        AUCTION_WON: 'winning',
        AUCTION_ENDING: 'endingSoon',
        OFFER_COUNTERED: 'counterOffer',
        OFFER_ACCEPTED: 'offerAccepted',
        OFFER_REJECTED: 'offerDeclined',
    };

    private isMuted(type: string, notifPrefs: Record<string, any>): boolean {
        if (notifPrefs.muteAll === true) return true;
        const key = NotificationsService.TYPE_PREF_KEY[type];
        return !!key && notifPrefs[key] === false;
    }

    // Server-local-time comparison — there's no per-user timezone on the User
    // model to do this precisely, so this is a best-effort improvement over
    // the previous "always push, quiet hours are decorative" behavior, not a
    // guarantee the push lands outside the user's actual quiet window.
    private isQuietHours(notifPrefs?: Record<string, any>): boolean {
        if (!notifPrefs || notifPrefs.quietHours !== true) return false;
        const start = notifPrefs.quietStart as string | undefined;
        const end = notifPrefs.quietEnd as string | undefined;
        if (!start || !end) return false;
        const toMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        const startM = toMinutes(start);
        const endM = toMinutes(end);
        if (startM === endM) return false;
        const now = new Date();
        const nowM = now.getHours() * 60 + now.getMinutes();
        return startM < endM
            ? nowM >= startM && nowM < endM
            : nowM >= startM || nowM < endM; // wraps midnight, e.g. 22:00 -> 08:00
    }

    async create(dto: CreateNotificationDto) {
        // 'link' is not a Prisma column — merge it into the JSON 'data' field
        const { link, ...prismaFields } = dto;
        const mergedData = { ...(dto.data || {}), ...(link ? { link } : {}) };

        const notification = await this.prisma.notification.create({
            data: {
                ...prismaFields,
                data: Object.keys(mergedData).length > 0 ? mergedData : undefined,
            },
        });

        // Respect the recipient's saved notification preferences before doing
        // anything interruptive — this used to only ever read expoPushToken
        // and ignore every other saved field, so every toggle in
        // NotificationSettingsScreen.tsx was inert (mobile-production-
        // readiness-plan.md F23). The row above is still always created
        // (existing callers rely on the returned object, and a muted event
        // should still show up next time the user checks their notification
        // list) — this only gates the two interruptive delivery paths below.
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { preferences: true },
        });
        const prefs = user?.preferences as Record<string, any> | null;
        const notifPrefs = prefs?.notifications as Record<string, any> | undefined;
        const muted = !!notifPrefs && this.isMuted(dto.type, notifPrefs);

        if (!muted) {
            // Real-time delivery (foreground — user has active socket connection)
            this.gateway.sendNotification(dto.userId, notification);

            // Expo push delivery (background / killed — user has no active
            // socket). Gated by the "Push" delivery-channel toggle too, not
            // just quiet hours — don't buzz the phone during the user's
            // chosen window, or at all if they turned push off. The row
            // above is already saved either way, so it's waiting next time
            // they open the app.
            const pushEnabled = notifPrefs?.push !== false;
            if (pushEnabled && !this.gateway.isUserConnected(dto.userId) && !this.isQuietHours(notifPrefs)) {
                const expoPushToken = prefs?.expoPushToken;
                if (expoPushToken) {
                    await this.pushToExpo(expoPushToken, {
                        title: dto.title,
                        body: dto.message,
                        data: { ...mergedData, notifId: notification.id },
                        channelId: this.getChannelId(dto.type),
                    });
                }
            }
        }

        return notification;
    }

    async findAll(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
        ]);
        return { data, total };
    }

    async getUnreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    /**
     * Get recent unread notifications for catch-up when a user reconnects to the notifications socket.
     */
    async getRecentUnread(userId: string, limit = 10) {
        return this.prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async markAsRead(id: string, userId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id, userId },
        });

        if (!notification) {
            return null;
        }

        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    private getChannelId(type: string): string {
        if (type.includes('BID') || type.includes('AUCTION')) return 'carmazium-bids';
        if (type.includes('MESSAGE') || type.includes('CHAT'))  return 'carmazium-messages';
        return 'carmazium-default';
    }

    private async pushToExpo(
        token: string,
        payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string },
    ): Promise<void> {
        if (!Expo.isExpoPushToken(token)) {
            this.logger.warn(`Invalid Expo push token: ${token}`);
            return;
        }

        const message: ExpoPushMessage = {
            to:        token,
            title:     payload.title,
            body:      payload.body,
            data:      payload.data ?? {},
            channelId: payload.channelId ?? 'carmazium-default',
            sound:     'default',
            priority:  'high',
        };

        const chunks = this.expo.chunkPushNotifications([message]);
        for (const chunk of chunks) {
            try {
                const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
                for (const ticket of tickets) {
                    if (ticket.status === 'error') {
                        this.logger.warn(`Expo push ticket error: ${ticket.details?.error} — token may be stale`);
                    }
                }
            } catch (err) {
                this.logger.error('Expo push send failed', err);
            }
        }
    }
}
