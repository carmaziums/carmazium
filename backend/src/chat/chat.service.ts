import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, SendMessageDto } from './dto';
import { ChatRoom, Message } from '@prisma/client';

/**
 * Chat service handling all chat room and message operations
 */
@Injectable()
export class ChatService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Find or create a chat room between two users
     */
    async findOrCreateRoom(userId: string, dto: CreateRoomDto): Promise<ChatRoom> {
        const { participantId, listingId } = dto;

        // Check if room already exists (either direction)
        const existingRoom = await this.prisma.chatRoom.findFirst({
            where: {
                OR: [
                    { initiatorId: userId, participantId },
                    { initiatorId: participantId, participantId: userId },
                ],
                deletedAt: null,
            },
        });

        if (existingRoom) {
            return existingRoom;
        }

        // Create new room
        return this.prisma.chatRoom.create({
            data: {
                initiatorId: userId,
                participantId,
                listingId,
            },
        });
    }

    /**
     * Get all chat rooms for a user with last message preview
     */
    async getUserRooms(userId: string): Promise<any[]> {
        const rooms = await this.prisma.chatRoom.findMany({
            where: {
                OR: [
                    { initiatorId: userId },
                    { participantId: userId },
                ],
                deletedAt: null,
            },
            include: {
                initiator: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
                participant: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
                listing: {
                    select: { id: true, title: true, slug: true, images: true },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        content: true,
                        senderId: true,
                        isRead: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Add unread count and format response
        return Promise.all(
            rooms.map(async (room) => {
                const unreadCount = await this.prisma.message.count({
                    where: {
                        chatRoomId: room.id,
                        senderId: { not: userId },
                        isRead: false,
                        deletedAt: null,
                    },
                });

                // Determine the other user
                const otherUser = room.initiatorId === userId ? room.participant : room.initiator;

                return {
                    id: room.id,
                    otherUser,
                    listing: room.listing,
                    lastMessage: room.messages[0] || null,
                    unreadCount,
                    updatedAt: room.updatedAt,
                };
            })
        );
    }

    /**
     * Get a single room with authorization check
     */
    async getRoom(roomId: string, userId: string): Promise<ChatRoom> {
        const room = await this.prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: {
                initiator: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
                participant: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
                listing: {
                    select: { id: true, title: true, slug: true, images: true },
                },
            },
        });

        if (!room || room.deletedAt) {
            throw new NotFoundException('Chat room not found');
        }

        if (room.initiatorId !== userId && room.participantId !== userId) {
            throw new ForbiddenException('You are not a member of this chat room');
        }

        return room;
    }

    /**
     * Get paginated messages for a room
     */
    async getRoomMessages(
        roomId: string,
        userId: string,
        page = 1,
        limit = 50,
    ): Promise<{ data: Message[]; total: number }> {
        // Verify user is member of room
        await this.getRoom(roomId, userId);

        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where: { chatRoomId: roomId, deletedAt: null },
                include: {
                    sender: {
                        select: { id: true, firstName: true, lastName: true, profileImage: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.message.count({
                where: { chatRoomId: roomId, deletedAt: null },
            }),
        ]);

        return { data: messages.reverse(), total };
    }

    /**
     * Send a message to a room
     */
    async sendMessage(roomId: string, senderId: string, dto: SendMessageDto): Promise<Message> {
        // Verify user is member of room
        await this.getRoom(roomId, senderId);

        // Create message
        const message = await this.prisma.message.create({
            data: {
                chatRoomId: roomId,
                senderId,
                content: dto.content,
            },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
            },
        });

        // Update room's updatedAt timestamp
        await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { updatedAt: new Date() },
        });

        return message;
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(roomId: string, userId: string): Promise<number> {
        // Verify user is member of room
        await this.getRoom(roomId, userId);

        // Mark all messages from other user as read
        const result = await this.prisma.message.updateMany({
            where: {
                chatRoomId: roomId,
                senderId: { not: userId },
                isRead: false,
            },
            data: { isRead: true },
        });

        return result.count;
    }

    /**
     * Get total unread message count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
        // Get all rooms where user is a member
        const rooms = await this.prisma.chatRoom.findMany({
            where: {
                OR: [
                    { initiatorId: userId },
                    { participantId: userId },
                ],
                deletedAt: null,
            },
            select: { id: true },
        });

        const roomIds = rooms.map((r) => r.id);

        return this.prisma.message.count({
            where: {
                chatRoomId: { in: roomIds },
                senderId: { not: userId },
                isRead: false,
                deletedAt: null,
            },
        });
    }

    /**
     * Get room IDs for a user (for WebSocket room joining)
     */
    async getUserRoomIds(userId: string): Promise<string[]> {
        const rooms = await this.prisma.chatRoom.findMany({
            where: {
                OR: [
                    { initiatorId: userId },
                    { participantId: userId },
                ],
                deletedAt: null,
            },
            select: { id: true },
        });

        return rooms.map((r) => r.id);
    }
}
