import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, SendMessageDto } from './dto';
import { Message } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

/**
 * Chat service handling all chat room and message operations
 */
@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    /**
     * Relations every room needs before it can be handed to the frontend —
     * shared so findOrCreateRoom/getRoom/getUserRooms never drift into
     * returning a bare row that's missing the computed `otherUser` the
     * frontend's ChatRoom type (and ChatWindow/ChatRoomList) require.
     */
    private readonly roomInclude = {
        initiator: {
            select: { id: true, firstName: true, lastName: true, profileImage: true, role: true },
        },
        participant: {
            select: { id: true, firstName: true, lastName: true, profileImage: true, role: true },
        },
        listing: {
            select: {
                id: true,
                title: true,
                slug: true,
                images: true,
                type: true,
                price: true,
                auction: {
                    select: {
                        id: true,
                        status: true,
                        winnerId: true,
                        buyerFeePaid: true,
                        winningBidAmount: true,
                    },
                },
            },
        },
    };

    /** Adds the computed `otherUser` field the frontend actually reads. */
    private withOtherUser<T extends { initiatorId: string; initiator: unknown; participant: unknown }>(
        room: T,
        userId: string,
    ) {
        return {
            ...room,
            otherUser: room.initiatorId === userId ? room.participant : room.initiator,
        };
    }

    /**
     * Find or create a chat room between two users
     */
    async findOrCreateRoom(userId: string, dto: CreateRoomDto) {
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

        // ChatRoom is unique per (initiatorId, participantId) pair — the same
        // two users always get the same room, even across unrelated deals on
        // different vehicles. `listingId` used to be frozen at whatever it
        // was on the room's very first creation and silently ignored on every
        // later findOrCreateRoom call, so a buyer/seller pair who transacted
        // on a second vehicle would still see the first vehicle's title/image
        // and (worse) have the auction-winner fee gate evaluated against the
        // wrong, possibly already-settled auction. Re-point the room at the
        // newly-referenced listing instead of leaving it stuck on the first one.
        if (listingId) {
            await this.assertCanReferenceListing(userId, listingId);
        }

        if (existingRoom) {
            const room = (listingId && listingId !== existingRoom.listingId)
                ? await this.prisma.chatRoom.update({
                    where: { id: existingRoom.id },
                    data: { listingId },
                    include: this.roomInclude,
                })
                : await this.prisma.chatRoom.findUniqueOrThrow({
                    where: { id: existingRoom.id },
                    include: this.roomInclude,
                });
            return this.withOtherUser(room, userId);
        }

        // Create new room
        const room = await this.prisma.chatRoom.create({
            data: {
                initiatorId: userId,
                participantId,
                listingId,
            },
            include: this.roomInclude,
        });
        return this.withOtherUser(room, userId);
    }

    /**
     * Get or create the current user's conversation with the official
     * CarMazium support account — the single ADMIN-role user. Reuses
     * findOrCreateRoom (no listingId) so it's the same unique per-pair room
     * a direct admin-initiated chat would land on, just resolved without the
     * caller needing to know the admin's user ID.
     */
    async findOrCreateSupportRoom(userId: string) {
        const supportAccount = await this.prisma.user.findFirst({
            where: { role: 'ADMIN', deletedAt: null },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });

        if (!supportAccount) {
            throw new NotFoundException('Support is not available right now.');
        }
        if (supportAccount.id === userId) {
            throw new ForbiddenException('You are the support account.');
        }

        return this.findOrCreateRoom(userId, { participantId: supportAccount.id });
    }

    /**
     * Gate auction rooms: the winner must have paid the £125 fee before
     * chatting about that specific auction. Runs whenever a listingId is
     * about to be attached to a room — both on first creation and when an
     * existing room is being re-pointed at a new listing.
     */
    private async assertCanReferenceListing(userId: string, listingId: string): Promise<void> {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                sellerId: true,
                type: true,
                auction: { select: { winnerId: true, buyerFeePaid: true } },
            },
        });

        if (listing?.type === 'AUCTION' && listing.auction?.winnerId) {
            const isWinner = listing.auction.winnerId === userId;
            if (isWinner && !listing.auction.buyerFeePaid) {
                throw new ForbiddenException(
                    'You must pay the £125 completion fee before messaging the seller.',
                );
            }
        }
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
                ...this.roomInclude,
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

                const { otherUser } = this.withOtherUser(room, userId);

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
    async getRoom(roomId: string, userId: string) {
        const room = await this.prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: this.roomInclude,
        });

        if (!room || room.deletedAt) {
            throw new NotFoundException('Chat room not found');
        }

        if (room.initiatorId !== userId && room.participantId !== userId) {
            throw new ForbiddenException('You are not a member of this chat room');
        }

        return this.withOtherUser(room, userId);
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

        // NOTIFICATION LOGIC
        // Determine recipient
        const room = await this.prisma.chatRoom.findUnique({
            where: { id: roomId },
            select: { initiatorId: true, participantId: true },
        });

        if (room) {
            const recipientId = room.initiatorId === senderId ? room.participantId : room.initiatorId;

            try {
                const notification = await this.notificationsService.create({
                    userId: recipientId,
                    type: 'MESSAGE_RECEIVED',
                    title: 'New Message',
                    message: dto.content.substring(0, 50) + (dto.content.length > 50 ? '...' : ''),
                    link: `/dashboard/user?tab=messages&room=${roomId}`,
                    data: { roomId, messageId: message.id },
                });
                this.notificationsGateway.sendNotification(recipientId, notification);
            } catch (notifErr) {
                // Non-fatal: message already saved and broadcast via chat gateway
                console.warn(`[ChatService] Failed to send message notification: ${notifErr?.message}`);
            }
        }

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
