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

        // Real-time delivery (foreground — user has active socket connection)
        this.gateway.sendNotification(dto.userId, notification);

        // Expo push delivery (background / killed — user has no active socket)
        if (!this.gateway.isUserConnected(dto.userId)) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.userId },
                select: { preferences: true },
            });
            const prefs = user?.preferences as Record<string, any> | null;
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
