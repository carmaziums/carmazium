import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, SendChatAttachmentDto, SendMessageDto } from './dto';
import { ChatContext, Message, Prisma, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { messageInboxLink } from './chat-routing';
import { ChatAttachmentService } from './chat-attachment.service';

/**
 * Chat service handling all chat room and message operations
 */
@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly chatAttachmentService: ChatAttachmentService,
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
                status: true,
                sellerId: true,
                deletedAt: true,
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

    private canonicalPair(userA: string, userB: string): [string, string] {
        return userA < userB ? [userA, userB] : [userB, userA];
    }

    private conversationKey(
        context: ChatContext,
        scopeId: string,
        userA: string,
        userB: string,
    ): string {
        const [firstUserId, secondUserId] = this.canonicalPair(userA, userB);
        return `${context}:${scopeId}:${firstUserId}:${secondUserId}`;
    }

    private async loadUsers(userId: string, participantId: string) {
        const users = await this.prisma.user.findMany({
            where: { id: { in: [userId, participantId] }, deletedAt: null },
            select: { id: true, role: true },
        });
        if (users.length !== 2) {
            throw new NotFoundException('Chat participant not found');
        }
        return users;
    }

    private async loadListingPolicy(listingId: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                sellerId: true,
                type: true,
                status: true,
                deletedAt: true,
                auction: {
                    select: {
                        id: true,
                        status: true,
                        winnerId: true,
                        buyerFeePaid: true,
                    },
                },
                offers: {
                    where: { status: 'ACCEPTED' },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: { buyerId: true },
                },
                sale: {
                    select: { buyerId: true },
                },
            },
        });

        if (!listing) {
            throw new NotFoundException('Listing not found');
        }
        return listing;
    }

    private pairMatches(
        initiatorId: string,
        participantId: string,
        userA: string,
        userB: string,
    ): boolean {
        const [roomA, roomB] = this.canonicalPair(initiatorId, participantId);
        const [expectedA, expectedB] = this.canonicalPair(userA, userB);
        return roomA === expectedA && roomB === expectedB;
    }

    private async resolveConversationRequest(
        userId: string,
        participantId: string,
        listingId?: string,
    ): Promise<{
        context: ChatContext;
        conversationKey: string;
        listingId: string | null;
        listing: any | null;
        users: Array<{ id: string; role: string }>;
    }> {
        if (userId === participantId) {
            throw new BadRequestException('You cannot create a chat with yourself');
        }

        const users = await this.loadUsers(userId, participantId);

        if (listingId) {
            const listing = await this.loadListingPolicy(listingId);
            const context = listing.type === 'AUCTION' ? ChatContext.AUCTION : ChatContext.RETAIL;
            const scopeId = context === ChatContext.AUCTION
                ? listing.auction?.id ?? listing.id
                : listing.id;

            return {
                context,
                conversationKey: this.conversationKey(context, scopeId, userId, participantId),
                listingId,
                listing,
                users,
            };
        }

        const hasAdmin = users.some((user) => user.role === 'ADMIN');
        if (!hasAdmin) {
            throw new ForbiddenException(
                'Direct chat requires a vehicle conversation or CarMazium support.',
            );
        }

        return {
            context: ChatContext.SUPPORT,
            conversationKey: this.conversationKey(ChatContext.SUPPORT, 'CARMAZIUM', userId, participantId),
            listingId: null,
            listing: null,
            users,
        };
    }

    private assertAuctionPolicy(
        listing: any,
        initiatorId: string,
        participantId: string,
    ): void {
        if (
            listing.deletedAt ||
            !listing.sellerId ||
            !listing.auction ||
            listing.auction.status !== 'ENDED' ||
            !listing.auction.winnerId ||
            !listing.auction.buyerFeePaid
        ) {
            throw new ForbiddenException(
                'Auction chat opens only after the auction has ended and the winner has paid the £125 CarMazium fee.',
            );
        }

        if (!this.pairMatches(
            initiatorId,
            participantId,
            listing.sellerId,
            listing.auction.winnerId,
        )) {
            throw new ForbiddenException(
                'Only the auction winner and seller can use this conversation.',
            );
        }
    }

    private acceptedRetailBuyerId(listing: any): string | null {
        return listing.offers?.[0]?.buyerId ?? listing.sale?.buyerId ?? null;
    }

    private assertRetailPair(listing: any, initiatorId: string, participantId: string): string {
        if (!listing.sellerId) {
            throw new ForbiddenException('This listing does not have a seller available for chat.');
        }

        if (initiatorId !== listing.sellerId && participantId !== listing.sellerId) {
            throw new ForbiddenException('Vehicle chat must be with the listing seller.');
        }

        return initiatorId === listing.sellerId ? participantId : initiatorId;
    }

    private assertCanCreateRetailConversation(
        listing: any,
        userId: string,
        participantId: string,
    ): void {
        if (listing.deletedAt) {
            throw new ForbiddenException('This listing is no longer active.');
        }

        const buyerId = this.assertRetailPair(listing, userId, participantId);

        if (listing.status === 'ACTIVE') {
            if (userId === listing.sellerId) {
                throw new ForbiddenException(
                    'A new retail enquiry must be started by the buyer.',
                );
            }
            return;
        }

        if (listing.status === 'OFFER_ACCEPTED') {
            const acceptedBuyerId = this.acceptedRetailBuyerId(listing);
            if (!acceptedBuyerId || acceptedBuyerId !== buyerId) {
                throw new ForbiddenException(
                    'This vehicle is sale pending. Only the accepted buyer and seller can start this conversation.',
                );
            }
            return;
        }

        if (listing.status === 'SOLD') {
            throw new ForbiddenException(
                'New conversations cannot be started after a vehicle is sold.',
            );
        }

        throw new ForbiddenException('This listing is not available for new conversations.');
    }

    private assertCanMessageRetailConversation(
        listing: any,
        initiatorId: string,
        participantId: string,
    ): void {
        if (listing.deletedAt) {
            throw new ForbiddenException('This listing is no longer active. The conversation is read-only.');
        }

        const buyerId = this.assertRetailPair(listing, initiatorId, participantId);

        if (listing.status === 'ACTIVE') {
            return;
        }

        if (listing.status === 'OFFER_ACCEPTED') {
            const acceptedBuyerId = this.acceptedRetailBuyerId(listing);
            if (acceptedBuyerId === buyerId) {
                return;
            }
            throw new ForbiddenException(
                'This vehicle is sale pending. Only the accepted buyer and seller can continue messaging.',
            );
        }

        if (listing.status === 'SOLD') {
            const completedBuyerId = listing.sale?.buyerId ?? this.acceptedRetailBuyerId(listing);
            if (completedBuyerId && completedBuyerId === buyerId) {
                return;
            }
            throw new ForbiddenException(
                'This vehicle has been sold. Only the completed buyer and seller can continue this conversation.',
            );
        }

        throw new ForbiddenException(
            'This listing is no longer active. The conversation is read-only.',
        );
    }

    private async assertConversationCanBeCreated(
        resolved: {
            context: ChatContext;
            conversationKey: string;
            listingId: string | null;
            listing: any | null;
            users: Array<{ id: string; role: string }>;
        },
        userId: string,
        participantId: string,
    ): Promise<void> {
        if (resolved.context === ChatContext.SUPPORT) {
            return;
        }
        if (!resolved.listing) {
            throw new ForbiddenException('Conversation context is incomplete.');
        }
        if (resolved.context === ChatContext.AUCTION) {
            this.assertAuctionPolicy(resolved.listing, userId, participantId);
            return;
        }
        if (resolved.context === ChatContext.RETAIL) {
            this.assertCanCreateRetailConversation(resolved.listing, userId, participantId);
            return;
        }
        throw new ForbiddenException('This conversation type cannot be created directly.');
    }

    /**
     * Find or create a context-specific conversation.
     * A buyer/seller pair may have separate rooms for separate vehicles, while
     * the database-level conversationKey prevents duplicate rooms for the same
     * context under concurrent requests.
     */
    async findOrCreateRoom(userId: string, dto: CreateRoomDto) {
        const { participantId, listingId } = dto;
        const resolved = await this.resolveConversationRequest(userId, participantId, listingId);

        const existingRoom = await this.prisma.chatRoom.findUnique({
            where: { conversationKey: resolved.conversationKey },
            include: this.roomInclude,
        });

        if (existingRoom && !existingRoom.deletedAt) {
            await this.assertCanMessageRoom(existingRoom.id, userId);
            return this.withOtherUser(existingRoom, userId);
        }

        await this.assertConversationCanBeCreated(resolved, userId, participantId);

        const room = await this.prisma.chatRoom.upsert({
            where: { conversationKey: resolved.conversationKey },
            update: {
                deletedAt: null,
            },
            create: {
                initiatorId: userId,
                participantId,
                listingId: resolved.listingId,
                context: resolved.context,
                conversationKey: resolved.conversationKey,
            },
            include: this.roomInclude,
        });

        return this.withOtherUser(room, userId);
    }

    /**
     * Get or create the current user's conversation with the official
     * CarMazium support account.
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
     * Enforces the current business rule whenever somebody attempts to send
     * or emit an interactive room event. Historical transcripts remain readable
     * even when the vehicle is no longer available.
     */
    async assertCanMessageRoom(roomId: string, userId: string) {
        const room = await this.prisma.chatRoom.findUnique({
            where: { id: roomId },
            select: {
                id: true,
                initiatorId: true,
                participantId: true,
                listingId: true,
                context: true,
                deletedAt: true,
                initiator: { select: { role: true } },
                participant: { select: { role: true } },
            },
        });

        if (!room || room.deletedAt) {
            throw new NotFoundException('Chat room not found');
        }
        if (room.initiatorId !== userId && room.participantId !== userId) {
            throw new ForbiddenException('You are not a member of this chat room');
        }

        if (room.context === ChatContext.SUPPORT || room.context === ChatContext.DISPUTE) {
            return room;
        }
        if (room.context === ChatContext.LEGACY) {
            throw new ForbiddenException('This historical conversation is read-only.');
        }
        if (!room.listingId) {
            throw new ForbiddenException('This conversation is missing its vehicle context.');
        }

        const listing = await this.loadListingPolicy(room.listingId);
        if (room.context === ChatContext.AUCTION) {
            this.assertAuctionPolicy(listing, room.initiatorId, room.participantId);
            return room;
        }
        if (room.context === ChatContext.RETAIL) {
            this.assertCanMessageRetailConversation(listing, room.initiatorId, room.participantId);
            return room;
        }

        throw new ForbiddenException('This conversation is not available for messaging.');
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
                        attachmentPath: true,
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
                    context: room.context,
                    conversationKey: room.conversationKey,
                    otherUser,
                    listing: room.listing,
                    listingUnavailable: !!room.listing && (
                        !!room.listing.deletedAt ||
                        !['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'].includes(room.listing.status)
                    ),
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
        before?: Date,
        beforeId?: string,
    ): Promise<{
        data: any[];
        total: number;
        hasMore: boolean;
        nextCursor: { createdAt: string; id: string } | null;
    }> {
        // Historical transcripts remain readable to room members even when the
        // room has become read-only.
        await this.getRoom(roomId, userId);

        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);
        const usingCursor = !!before && !!beforeId;

        const where: Prisma.MessageWhereInput = {
            chatRoomId: roomId,
            deletedAt: null,
            ...(usingCursor ? {
                OR: [
                    { createdAt: { lt: before } },
                    { createdAt: before, id: { lt: beforeId } },
                ],
            } : {}),
        };

        const [rows, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                include: {
                    sender: {
                        select: { id: true, firstName: true, lastName: true, profileImage: true },
                    },
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
                skip: usingCursor ? 0 : (safePage - 1) * safeLimit,
                take: usingCursor ? safeLimit + 1 : safeLimit,
            }),
            this.prisma.message.count({
                where: { chatRoomId: roomId, deletedAt: null },
            }),
        ]);

        const hasMore = usingCursor
            ? rows.length > safeLimit
            : safePage * safeLimit < total;
        const visibleRows = (usingCursor ? rows.slice(0, safeLimit) : rows).reverse();
        const oldest = visibleRows[0];

        const hydratedRows = await this.chatAttachmentService.hydrateMessages(visibleRows);

        return {
            data: hydratedRows,
            total,
            hasMore,
            nextCursor: oldest
                ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
                : null,
        };
    }

    private readonly messageInclude = {
        sender: {
            select: { id: true, firstName: true, lastName: true, profileImage: true },
        },
    };

    private async findMessageByClientId(senderId: string, clientMessageId: string) {
        return this.prisma.message.findFirst({
            where: { senderId, clientMessageId },
            include: this.messageInclude,
        });
    }

    private assertIdempotentMessageMatches(
        existing: any,
        roomId: string,
        content: string,
    ): void {
        if (
            existing.chatRoomId !== roomId ||
            existing.content !== content ||
            existing.attachmentPath ||
            existing.deletedAt
        ) {
            throw new BadRequestException(
                'This message retry key has already been used for a different message.',
            );
        }
    }

    /**
     * Persist a message exactly once. The client-generated message ID survives
     * WebSocket timeouts and HTTP fallback retries, so a lost acknowledgement
     * cannot create a duplicate message.
     */
    async sendMessage(
        roomId: string,
        senderId: string,
        dto: SendMessageDto,
    ): Promise<{ message: any; created: boolean }> {
        const room = await this.assertCanMessageRoom(roomId, senderId);

        if (dto.clientMessageId) {
            const existing = await this.findMessageByClientId(
                senderId,
                dto.clientMessageId,
            );
            if (existing) {
                this.assertIdempotentMessageMatches(existing, roomId, dto.content);
                return { message: existing, created: false };
            }
        }

        let message: any;
        try {
            message = await this.prisma.message.create({
                data: {
                    chatRoomId: roomId,
                    senderId,
                    clientMessageId: dto.clientMessageId,
                    content: dto.content,
                },
                include: this.messageInclude,
            });
        } catch (error) {
            // Two retries can race. The unique sender/clientMessageId index is
            // the final authority; if another request won, return that exact
            // saved message rather than surfacing a false failure.
            if (
                dto.clientMessageId &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const existing = await this.findMessageByClientId(
                    senderId,
                    dto.clientMessageId,
                );
                if (existing) {
                    this.assertIdempotentMessageMatches(existing, roomId, dto.content);
                    return { message: existing, created: false };
                }
            }
            throw error;
        }

        await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { updatedAt: new Date() },
        });

        const recipientId = room.initiatorId === senderId
            ? room.participantId
            : room.initiatorId;
        const recipientRole = (
            room.initiatorId === senderId
                ? room.participant.role
                : room.initiator.role
        ) as UserRole;

        try {
            const notification = await this.notificationsService.create({
                userId: recipientId,
                type: 'MESSAGE_RECEIVED',
                title: 'New Message',
                message: dto.content.substring(0, 50) + (dto.content.length > 50 ? '...' : ''),
                link: messageInboxLink(recipientRole, roomId),
                data: { roomId, messageId: message.id },
            });
            this.notificationsGateway.sendNotification(recipientId, notification);
        } catch (notifErr) {
            console.warn(`[ChatService] Failed to send message notification: ${notifErr?.message}`);
        }

        return { message, created: true };
    }

    private assertIdempotentAttachmentMatches(
        existing: any,
        roomId: string,
        dto: SendChatAttachmentDto,
    ): void {
        const content = dto.caption?.trim() || '';
        if (
            existing.chatRoomId !== roomId ||
            existing.content !== content ||
            existing.attachmentPath !== dto.path ||
            existing.attachmentName !== dto.name ||
            existing.attachmentMime !== dto.mime ||
            existing.attachmentSize !== dto.size ||
            existing.deletedAt
        ) {
            throw new BadRequestException(
                'This message retry key has already been used for a different message.',
            );
        }
    }

    /**
     * Send a private photo message. Storage access is scoped to the room and
     * sender path; recipients only receive a short-lived signed read URL.
     */
    async sendAttachmentMessage(
        roomId: string,
        senderId: string,
        dto: SendChatAttachmentDto,
    ): Promise<{ message: any; created: boolean }> {
        const room = await this.assertCanMessageRoom(roomId, senderId);
        this.chatAttachmentService.validateMetadata(dto.name, dto.mime, dto.size);
        this.chatAttachmentService.assertPathOwnership(dto.path, roomId, senderId);

        const content = dto.caption?.trim() || '';

        if (dto.clientMessageId) {
            const existing = await this.findMessageByClientId(
                senderId,
                dto.clientMessageId,
            );
            if (existing) {
                this.assertIdempotentAttachmentMatches(existing, roomId, dto);
                return {
                    message: await this.chatAttachmentService.hydrateMessage(existing),
                    created: false,
                };
            }
        }

        await this.chatAttachmentService.assertUploaded(dto.path);

        let message: any;
        try {
            message = await this.prisma.message.create({
                data: {
                    chatRoomId: roomId,
                    senderId,
                    clientMessageId: dto.clientMessageId,
                    content,
                    attachmentPath: dto.path,
                    attachmentName: dto.name.trim(),
                    attachmentMime: dto.mime,
                    attachmentSize: dto.size,
                },
                include: this.messageInclude,
            });
        } catch (error) {
            if (
                dto.clientMessageId &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const existing = await this.findMessageByClientId(
                    senderId,
                    dto.clientMessageId,
                );
                if (existing) {
                    this.assertIdempotentAttachmentMatches(existing, roomId, dto);
                    return {
                        message: await this.chatAttachmentService.hydrateMessage(existing),
                        created: false,
                    };
                }
            }
            throw error;
        }

        await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { updatedAt: new Date() },
        });

        const recipientId = room.initiatorId === senderId
            ? room.participantId
            : room.initiatorId;
        const recipientRole = (
            room.initiatorId === senderId
                ? room.participant.role
                : room.initiator.role
        ) as UserRole;

        const preview = content
            ? `Photo: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`
            : 'You received a photo.';

        try {
            const notification = await this.notificationsService.create({
                userId: recipientId,
                type: 'MESSAGE_RECEIVED',
                title: 'New Photo',
                message: preview,
                link: messageInboxLink(recipientRole, roomId),
                data: { roomId, messageId: message.id, hasAttachment: true },
            });
            this.notificationsGateway.sendNotification(recipientId, notification);
        } catch (notifErr) {
            console.warn(`[ChatService] Failed to send photo notification: ${notifErr?.message}`);
        }

        return {
            message: await this.chatAttachmentService.hydrateMessage(message),
            created: true,
        };
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
