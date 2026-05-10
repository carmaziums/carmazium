import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateNotificationDto) {
        // 'link' is not a Prisma column — merge it into the JSON 'data' field
        const { link, ...prismaFields } = dto;
        const mergedData = { ...(dto.data || {}), ...(link ? { link } : {}) };
        return this.prisma.notification.create({
            data: {
                ...prismaFields,
                data: Object.keys(mergedData).length > 0 ? mergedData : undefined,
            },
        });
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
        // Verify ownership
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
}
