import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, OpenDisputeDto, SendChatAttachmentDto, SendMessageDto } from './dto';
import { ChatContext, DisputeStatus, Message, Prisma, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { messageInboxLink } from './chat-routing';
import { ChatAttachmentService } from './chat-attachment.service';

/**
 * Chat service handling all chat room and message operations
 */
const DISPUTE_EVENT_PREFIX = '__CARMAZIUM_DISPUTE_EVENT_V1__:';

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
        supportAssignedAdmin: {
            select: { id: true, firstName: true, lastName: true, email: true, profileImage: true },
        },
        disputeCase: {
            select: {
                id: true,
                sourceRoomId: true,
                chatRoomId: true,
                listingId: true,
                buyerId: true,
                sellerId: true,
                openedById: true,
                joinedAdminId: true,
                resolvedById: true,
                status: true,
                reason: true,
                adminJoinedAt: true,
                resolvedAt: true,
                createdAt: true,
                updatedAt: true,
                buyer: {
                    select: { id: true, firstName: true, lastName: true, email: true, profileImage: true, role: true },
                },
                seller: {
                    select: { id: true, firstName: true, lastName: true, email: true, profileImage: true, role: true },
                },
                joinedAdmin: {
                    select: { id: true, firstName: true, lastName: true, email: true, profileImage: true, role: true },
                },
            },
        },
        disputeAsSource: {
            select: {
                id: true,
                chatRoomId: true,
                status: true,
            },
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
    private withOtherUser<T extends {
        initiatorId: string;
        participantId?: string;
        context?: ChatContext;
        initiator: any;
        participant: any;
    }>(
        room: T,
        userId: string,
    ) {
        let otherUser: any;
        if (room.initiatorId === userId) {
            otherUser = room.participant;
        } else if (room.participantId === userId) {
            otherUser = room.initiator;
        } else if (room.context === ChatContext.SUPPORT) {
            // Explicitly authorised support agents who are not one of the
            // canonical pair still see the customer, never another staff member.
            otherUser = room.initiator?.role === UserRole.ADMIN
                ? room.participant
                : room.initiator;
        } else if (room.context === ChatContext.DISPUTE) {
            // Joined admins see the buyer as the primary counterpart in the
            // generic two-party shell; disputeCase exposes both buyer + seller.
            otherUser = room.disputeCase?.buyer || room.initiator;
        } else {
            otherUser = room.initiator;
        }

        return {
            ...room,
            otherUser,
        };
    }

    private supportCustomerId(room: any): string | null {
        if (room.context !== ChatContext.SUPPORT) return null;
        if (room.initiator?.role === UserRole.ADMIN) return room.participantId;
        if (room.participant?.role === UserRole.ADMIN) return room.initiatorId;
        return null;
    }

    private supportCanonicalAdminId(room: any): string | null {
        if (room.context !== ChatContext.SUPPORT) return null;
        if (room.initiator?.role === UserRole.ADMIN) return room.initiatorId;
        if (room.participant?.role === UserRole.ADMIN) return room.participantId;
        return null;
    }

    private async actorRole(userId: string): Promise<UserRole | null> {
        const actor = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, deletedAt: true },
        });
        return actor && !actor.deletedAt ? actor.role : null;
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

        const admins = users.filter((user) => user.role === UserRole.ADMIN);
        const customers = users.filter((user) => user.role !== UserRole.ADMIN);
        if (admins.length !== 1 || customers.length !== 1) {
            throw new ForbiddenException(
                'Direct chat requires one CarMazium admin and one member.',
            );
        }

        return {
            context: ChatContext.SUPPORT,
            conversationKey: `SUPPORT:CARMAZIUM:${customers[0].id}`,
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
                supportAssignedAdminId: resolved.context === ChatContext.SUPPORT
                    ? resolved.users.find((candidate) => candidate.role === UserRole.ADMIN)?.id
                    : undefined,
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

    private disputeEventContent(
        type: 'OPENED' | 'ADMIN_JOINED' | 'RESOLVED',
        payload: Record<string, unknown> = {},
    ) {
        return DISPUTE_EVENT_PREFIX + JSON.stringify({ type, ...payload });
    }

    private async notifyDisputeParticipant(
        userId: string,
        role: UserRole,
        roomId: string,
        type: string,
        title: string,
        message: string,
        disputeId: string,
    ) {
        try {
            const notification = await this.notificationsService.create({
                userId,
                type,
                title,
                message,
                link: messageInboxLink(role, roomId),
                data: { roomId, disputeId },
            });
            this.notificationsGateway.sendNotification(userId, notification);
        } catch (error: any) {
            console.warn(
                `[ChatService] Failed to notify dispute participant ${userId}: ${error?.message}`,
            );
        }
    }

    /**
     * Open one dispute case from an existing vehicle conversation. The original
     * RETAIL/AUCTION thread stays private; the dispute gets its own room.
     */
    async openDispute(
        sourceRoomId: string,
        userId: string,
        dto: OpenDisputeDto,
    ) {
        const sourceRoom: any = await this.getRoom(sourceRoomId, userId);
        if (
            sourceRoom.context !== ChatContext.RETAIL &&
            sourceRoom.context !== ChatContext.AUCTION
        ) {
            throw new BadRequestException(
                'A dispute can only be opened from a vehicle transaction conversation.',
            );
        }
        if (
            sourceRoom.initiatorId !== userId &&
            sourceRoom.participantId !== userId
        ) {
            throw new ForbiddenException('Only the buyer or seller can open this dispute.');
        }
        if (!sourceRoom.listingId || !sourceRoom.listing?.sellerId) {
            throw new BadRequestException('This conversation does not have a valid vehicle seller.');
        }
        if (
            sourceRoom.context === ChatContext.RETAIL &&
            !['OFFER_ACCEPTED', 'SOLD'].includes(sourceRoom.listing.status)
        ) {
            throw new BadRequestException(
                'Retail disputes are available after an offer has been accepted or the vehicle has been sold.',
            );
        }

        const sellerId = sourceRoom.listing.sellerId;
        if (
            sourceRoom.initiatorId !== sellerId &&
            sourceRoom.participantId !== sellerId
        ) {
            throw new BadRequestException(
                'The source conversation no longer matches the vehicle seller.',
            );
        }
        const buyerId = sourceRoom.initiatorId === sellerId
            ? sourceRoom.participantId
            : sourceRoom.initiatorId;

        const existingCase = await this.prisma.disputeCase.findUnique({
            where: { sourceRoomId },
        });
        if (existingCase) {
            return {
                room: await this.getRoom(existingCase.chatRoomId, userId),
                dispute: existingCase,
                eventMessage: null,
                created: false,
            };
        }

        const reason = dto.reason?.trim() || null;

        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const disputeRoom = await tx.chatRoom.create({
                    data: {
                        initiatorId: buyerId,
                        participantId: sellerId,
                        listingId: sourceRoom.listingId,
                        context: ChatContext.DISPUTE,
                        conversationKey: `DISPUTE:${sourceRoomId}`,
                    },
                });

                const dispute = await tx.disputeCase.create({
                    data: {
                        sourceRoomId,
                        chatRoomId: disputeRoom.id,
                        listingId: sourceRoom.listingId,
                        buyerId,
                        sellerId,
                        openedById: userId,
                        reason,
                    },
                });

                await tx.disputeReadState.createMany({
                    data: [
                        {
                            disputeId: dispute.id,
                            userId: buyerId,
                            lastReadAt: userId === buyerId ? new Date() : null,
                        },
                        {
                            disputeId: dispute.id,
                            userId: sellerId,
                            lastReadAt: userId === sellerId ? new Date() : null,
                        },
                    ],
                });

                const eventMessage = await tx.message.create({
                    data: {
                        chatRoomId: disputeRoom.id,
                        senderId: userId,
                        content: this.disputeEventContent('OPENED', {
                            disputeId: dispute.id,
                            reason,
                        }),
                    },
                    include: this.messageInclude,
                });

                await tx.chatRoom.update({
                    where: { id: disputeRoom.id },
                    data: { updatedAt: new Date() },
                });

                const hydratedRoom = await tx.chatRoom.findUnique({
                    where: { id: disputeRoom.id },
                    include: this.roomInclude,
                });

                return { dispute, eventMessage, hydratedRoom };
            });

            if (!created.hydratedRoom) {
                throw new NotFoundException('Dispute conversation could not be created.');
            }

            const otherId = userId === buyerId ? sellerId : buyerId;
            const otherRole = sourceRoom.initiatorId === otherId
                ? sourceRoom.initiator.role
                : sourceRoom.participant.role;
            await this.notifyDisputeParticipant(
                otherId,
                otherRole as UserRole,
                created.dispute.chatRoomId,
                'DISPUTE_OPENED',
                'Vehicle dispute opened',
                'A dispute has been opened for your CarMazium vehicle transaction.',
                created.dispute.id,
            );

            const admins = await this.prisma.user.findMany({
                where: { role: UserRole.ADMIN, deletedAt: null },
                select: { id: true },
            });
            for (const admin of admins) {
                try {
                    const notification = await this.notificationsService.create({
                        userId: admin.id,
                        type: 'DISPUTE_OPENED',
                        title: 'New vehicle dispute',
                        message: sourceRoom.listing?.title
                            ? `A dispute was opened for ${sourceRoom.listing.title}.`
                            : 'A new vehicle dispute requires review.',
                        link: `/dashboard/admin/messages?mode=disputes&dispute=${created.dispute.id}`,
                        data: {
                            disputeId: created.dispute.id,
                            roomId: created.dispute.chatRoomId,
                            sourceRoomId,
                        },
                    });
                    this.notificationsGateway.sendNotification(admin.id, notification);
                } catch (error: any) {
                    console.warn(
                        `[ChatService] Failed to notify admin ${admin.id} of dispute: ${error?.message}`,
                    );
                }
            }

            return {
                room: this.withOtherUser(created.hydratedRoom, userId),
                dispute: created.dispute,
                eventMessage: created.eventMessage,
                created: true,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const concurrent = await this.prisma.disputeCase.findUnique({
                    where: { sourceRoomId },
                });
                if (concurrent) {
                    return {
                        room: await this.getRoom(concurrent.chatRoomId, userId),
                        dispute: concurrent,
                        eventMessage: null,
                        created: false,
                    };
                }
            }
            throw error;
        }
    }

    async listDisputes(
        page = 1,
        limit = 30,
        status?: string,
        search?: string,
    ) {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const where: Prisma.DisputeCaseWhereInput = {};

        if (status) {
            if (!Object.values(DisputeStatus).includes(status as DisputeStatus)) {
                throw new BadRequestException('Unknown dispute status.');
            }
            where.status = status as DisputeStatus;
        }

        const cleanSearch = search?.trim();
        if (cleanSearch) {
            where.OR = [
                { listing: { title: { contains: cleanSearch, mode: 'insensitive' } } },
                { buyer: { email: { contains: cleanSearch, mode: 'insensitive' } } },
                { seller: { email: { contains: cleanSearch, mode: 'insensitive' } } },
                { reason: { contains: cleanSearch, mode: 'insensitive' } },
            ];
        }

        const include = {
            listing: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    images: true,
                    type: true,
                    status: true,
                },
            },
            buyer: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                    role: true,
                },
            },
            seller: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                    role: true,
                },
            },
            openedBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                },
            },
            joinedAdmin: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                },
            },
            resolvedBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            chatRoom: {
                select: {
                    id: true,
                    updatedAt: true,
                    messages: {
                        orderBy: { createdAt: 'desc' as const },
                        take: 1,
                        select: {
                            id: true,
                            content: true,
                            senderId: true,
                            createdAt: true,
                        },
                    },
                },
            },
        };

        const [data, total] = await Promise.all([
            this.prisma.disputeCase.findMany({
                where,
                include,
                orderBy: { createdAt: 'desc' },
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
            }),
            this.prisma.disputeCase.count({ where }),
        ]);

        return {
            data,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit),
            },
        };
    }

    async joinDispute(disputeId: string, adminId: string) {
        const role = await this.actorRole(adminId);
        if (role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only an active CarMazium admin can join a dispute.');
        }

        const existing = await this.prisma.disputeCase.findUnique({
            where: { id: disputeId },
        });
        if (!existing) {
            throw new NotFoundException('Dispute not found.');
        }
        if (existing.status !== DisputeStatus.OPEN) {
            throw new BadRequestException('Only an open dispute can be joined.');
        }
        if (existing.joinedAdminId === adminId) {
            return {
                room: await this.getRoom(existing.chatRoomId, adminId),
                eventMessage: null,
                joined: false,
            };
        }
        if (existing.joinedAdminId) {
            throw new BadRequestException('This dispute is already assigned to another admin.');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const claim = await tx.disputeCase.updateMany({
                where: {
                    id: disputeId,
                    status: DisputeStatus.OPEN,
                    joinedAdminId: null,
                },
                data: {
                    joinedAdminId: adminId,
                    adminJoinedAt: new Date(),
                },
            });
            if (claim.count !== 1) {
                throw new BadRequestException('This dispute was claimed by another admin.');
            }

            const dispute = await tx.disputeCase.findUnique({
                where: { id: disputeId },
            });
            if (!dispute) {
                throw new NotFoundException('Dispute not found.');
            }

            await tx.disputeReadState.upsert({
                where: {
                    disputeId_userId: {
                        disputeId,
                        userId: adminId,
                    },
                },
                update: {},
                create: {
                    disputeId,
                    userId: adminId,
                    lastReadAt: null,
                },
            });

            const eventMessage = await tx.message.create({
                data: {
                    chatRoomId: dispute.chatRoomId,
                    senderId: adminId,
                    content: this.disputeEventContent('ADMIN_JOINED', {
                        disputeId,
                    }),
                },
                include: this.messageInclude,
            });
            await tx.chatRoom.update({
                where: { id: dispute.chatRoomId },
                data: { updatedAt: new Date() },
            });

            const room = await tx.chatRoom.findUnique({
                where: { id: dispute.chatRoomId },
                include: this.roomInclude,
            });
            return { dispute, eventMessage, room };
        });

        if (!result.room) {
            throw new NotFoundException('Dispute conversation not found.');
        }

        for (const participant of [
            { id: result.dispute.buyerId, role: result.room.initiatorId === result.dispute.buyerId ? result.room.initiator.role : result.room.participant.role },
            { id: result.dispute.sellerId, role: result.room.initiatorId === result.dispute.sellerId ? result.room.initiator.role : result.room.participant.role },
        ]) {
            await this.notifyDisputeParticipant(
                participant.id,
                participant.role as UserRole,
                result.dispute.chatRoomId,
                'DISPUTE_ADMIN_JOINED',
                'CarMazium joined your dispute',
                'A CarMazium support agent has joined the dispute conversation.',
                result.dispute.id,
            );
        }

        return {
            room: this.withOtherUser(result.room, adminId),
            eventMessage: result.eventMessage,
            joined: true,
        };
    }

    async resolveDispute(disputeId: string, adminId: string) {
        const role = await this.actorRole(adminId);
        if (role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only an active CarMazium admin can resolve a dispute.');
        }

        const current = await this.prisma.disputeCase.findUnique({
            where: { id: disputeId },
        });
        if (!current) {
            throw new NotFoundException('Dispute not found.');
        }
        if (current.status === DisputeStatus.RESOLVED) {
            return {
                room: await this.getRoom(current.chatRoomId, adminId),
                eventMessage: null,
                resolved: false,
            };
        }
        if (current.joinedAdminId !== adminId) {
            throw new ForbiddenException(
                'Only the admin who joined this dispute can resolve it.',
            );
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const resolution = await tx.disputeCase.updateMany({
                where: {
                    id: disputeId,
                    status: DisputeStatus.OPEN,
                    joinedAdminId: adminId,
                },
                data: {
                    status: DisputeStatus.RESOLVED,
                    resolvedById: adminId,
                    resolvedAt: new Date(),
                },
            });
            if (resolution.count !== 1) {
                throw new BadRequestException('This dispute changed before it could be resolved.');
            }

            const dispute = await tx.disputeCase.findUnique({
                where: { id: disputeId },
            });
            if (!dispute) {
                throw new NotFoundException('Dispute not found.');
            }

            const eventMessage = await tx.message.create({
                data: {
                    chatRoomId: dispute.chatRoomId,
                    senderId: adminId,
                    content: this.disputeEventContent('RESOLVED', {
                        disputeId,
                    }),
                },
                include: this.messageInclude,
            });
            await tx.chatRoom.update({
                where: { id: dispute.chatRoomId },
                data: { updatedAt: new Date() },
            });

            const room = await tx.chatRoom.findUnique({
                where: { id: dispute.chatRoomId },
                include: this.roomInclude,
            });
            return { dispute, eventMessage, room };
        });

        if (!result.room) {
            throw new NotFoundException('Dispute conversation not found.');
        }

        for (const participant of [
            { id: result.dispute.buyerId, role: result.room.initiatorId === result.dispute.buyerId ? result.room.initiator.role : result.room.participant.role },
            { id: result.dispute.sellerId, role: result.room.initiatorId === result.dispute.sellerId ? result.room.initiator.role : result.room.participant.role },
        ]) {
            await this.notifyDisputeParticipant(
                participant.id,
                participant.role as UserRole,
                result.dispute.chatRoomId,
                'DISPUTE_RESOLVED',
                'Vehicle dispute resolved',
                'CarMazium has marked this dispute as resolved. The transcript remains available.',
                result.dispute.id,
            );
        }

        return {
            room: this.withOtherUser(result.room, adminId),
            eventMessage: result.eventMessage,
            resolved: true,
        };
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
                supportAssignedAdminId: true,
                supportClosedAt: true,
                deletedAt: true,
                disputeCase: {
                    select: {
                        id: true,
                        status: true,
                        joinedAdminId: true,
                    },
                },
                initiator: { select: { role: true } },
                participant: { select: { role: true } },
            },
        });

        if (!room || room.deletedAt) {
            throw new NotFoundException('Chat room not found');
        }
        if (room.initiatorId !== userId && room.participantId !== userId) {
            const role = await this.actorRole(userId);
            const authorisedSupportAdmin =
                room.context === ChatContext.SUPPORT && role === UserRole.ADMIN;
            const authorisedDisputeAdmin =
                room.context === ChatContext.DISPUTE &&
                role === UserRole.ADMIN &&
                room.disputeCase?.joinedAdminId === userId;

            if (!authorisedSupportAdmin && !authorisedDisputeAdmin) {
                throw new ForbiddenException('You are not a member of this chat room');
            }
        }

        if (room.context === ChatContext.SUPPORT) {
            return room;
        }
        if (room.context === ChatContext.DISPUTE) {
            if (!room.disputeCase) {
                throw new ForbiddenException('This dispute conversation is missing its case record.');
            }
            if (room.disputeCase.status !== DisputeStatus.OPEN) {
                throw new ForbiddenException('This dispute has been resolved. The conversation is read-only.');
            }
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
        const role = await this.actorRole(userId);
        const rooms = await this.prisma.chatRoom.findMany({
            where: {
                OR: role === UserRole.ADMIN
                    ? [
                        { context: ChatContext.SUPPORT },
                        {
                            context: ChatContext.DISPUTE,
                            disputeCase: { is: { joinedAdminId: userId } },
                        },
                        { initiatorId: userId },
                        { participantId: userId },
                    ]
                    : [
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
                        sender: { select: { role: true } },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Add unread count and format response
        return Promise.all(
            rooms.map(async (room) => {
                const customerId = this.supportCustomerId(room);
                let unreadCount: number;

                if (room.context === ChatContext.DISPUTE && room.disputeCase) {
                    const readState = await this.prisma.disputeReadState.findUnique({
                        where: {
                            disputeId_userId: {
                                disputeId: room.disputeCase.id,
                                userId,
                            },
                        },
                        select: { lastReadAt: true },
                    });

                    unreadCount = await this.prisma.message.count({
                        where: {
                            chatRoomId: room.id,
                            senderId: { not: userId },
                            deletedAt: null,
                            ...(readState?.lastReadAt
                                ? { createdAt: { gt: readState.lastReadAt } }
                                : {}),
                        },
                    });
                } else {
                    unreadCount = await this.prisma.message.count({
                        where: {
                            chatRoomId: room.id,
                            ...(room.context === ChatContext.SUPPORT && role === UserRole.ADMIN && customerId
                                ? { senderId: customerId }
                                : { senderId: { not: userId } }),
                            isRead: false,
                            deletedAt: null,
                        },
                    });
                }

                const { otherUser } = this.withOtherUser(room, userId);
                const lastMessage = room.messages[0] || null;
                const needsReply = room.context === ChatContext.SUPPORT
                    && !!lastMessage
                    && lastMessage.sender?.role !== UserRole.ADMIN
                    && !room.supportClosedAt;

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
                    supportAssignedAdmin: room.supportAssignedAdmin,
                    supportAssignedAdminId: room.supportAssignedAdminId,
                    supportTags: room.supportTags,
                    supportClosedAt: room.supportClosedAt,
                    disputeCase: room.disputeCase,
                    sourceDispute: room.disputeAsSource,
                    canOpenDispute:
                        !room.disputeAsSource &&
                        (
                            room.context === ChatContext.AUCTION ||
                            (
                                room.context === ChatContext.RETAIL &&
                                !!room.listing &&
                                ['OFFER_ACCEPTED', 'SOLD'].includes(room.listing.status)
                            )
                        ),
                    needsReply,
                    lastMessage,
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
            const role = await this.actorRole(userId);
            const authorisedSupportAdmin =
                room.context === ChatContext.SUPPORT && role === UserRole.ADMIN;
            const authorisedDisputeAdmin =
                room.context === ChatContext.DISPUTE &&
                role === UserRole.ADMIN &&
                room.disputeCase?.joinedAdminId === userId;

            if (!authorisedSupportAdmin && !authorisedDisputeAdmin) {
                throw new ForbiddenException('You are not a member of this chat room');
            }
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

    private async resolveMessageRouting(room: any, senderId: string) {
        const senderRole = await this.actorRole(senderId);
        if (!senderRole) {
            throw new ForbiddenException('Chat sender is not available.');
        }

        if (room.context === ChatContext.SUPPORT) {
            const customerId = this.supportCustomerId(room);
            const canonicalAdminId = this.supportCanonicalAdminId(room);
            if (!customerId || !canonicalAdminId) {
                throw new ForbiddenException('Support conversation participants are invalid.');
            }

            if (senderRole === UserRole.ADMIN) {
                const customerRole = room.initiatorId === customerId
                    ? room.initiator.role
                    : room.participant.role;
                return {
                    senderRole,
                    recipients: [{
                        id: customerId,
                        role: customerRole as UserRole,
                    }],
                    roomUpdate: {
                        supportClosedAt: null,
                        ...(room.supportAssignedAdminId
                            ? {}
                            : { supportAssignedAdminId: senderId }),
                    },
                };
            }

            return {
                senderRole,
                recipients: [{
                    id: room.supportAssignedAdminId || canonicalAdminId,
                    role: UserRole.ADMIN,
                }],
                roomUpdate: { supportClosedAt: null },
            };
        }

        if (room.context === ChatContext.DISPUTE) {
            if (!room.disputeCase || room.disputeCase.status !== DisputeStatus.OPEN) {
                throw new ForbiddenException('This dispute is not open for messaging.');
            }

            const recipients = [
                room.initiatorId !== senderId
                    ? { id: room.initiatorId, role: room.initiator.role as UserRole }
                    : null,
                room.participantId !== senderId
                    ? { id: room.participantId, role: room.participant.role as UserRole }
                    : null,
                room.disputeCase.joinedAdminId && room.disputeCase.joinedAdminId !== senderId
                    ? { id: room.disputeCase.joinedAdminId, role: UserRole.ADMIN }
                    : null,
            ].filter(Boolean) as Array<{ id: string; role: UserRole }>;

            return {
                senderRole,
                recipients: Array.from(
                    new Map(recipients.map((recipient) => [recipient.id, recipient])).values(),
                ),
                roomUpdate: {},
            };
        }

        return {
            senderRole,
            recipients: [{
                id: room.initiatorId === senderId
                    ? room.participantId
                    : room.initiatorId,
                role: (
                    room.initiatorId === senderId
                        ? room.participant.role
                        : room.initiator.role
                ) as UserRole,
            }],
            roomUpdate: {},
        };
    }

    private async notifyMessageRecipients(
        recipients: Array<{ id: string; role: UserRole }>,
        roomId: string,
        messageId: string,
        title: string,
        preview: string,
        data: Record<string, unknown> = {},
    ) {
        for (const recipient of recipients) {
            try {
                const notification = await this.notificationsService.create({
                    userId: recipient.id,
                    type: 'MESSAGE_RECEIVED',
                    title,
                    message: preview,
                    link: messageInboxLink(recipient.role, roomId),
                    data: { roomId, messageId, ...data },
                });
                this.notificationsGateway.sendNotification(recipient.id, notification);
            } catch (notifErr: any) {
                console.warn(
                    `[ChatService] Failed to send chat notification to ${recipient.id}: ${notifErr?.message}`,
                );
            }
        }
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
        if (dto.content.startsWith(DISPUTE_EVENT_PREFIX)) {
            throw new BadRequestException('This message format is reserved for CarMazium dispute events.');
        }

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

        const routing = await this.resolveMessageRouting(room, senderId);
        await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: {
                updatedAt: new Date(),
                ...routing.roomUpdate,
            },
        });

        await this.notifyMessageRecipients(
            routing.recipients,
            roomId,
            message.id,
            'New Message',
            dto.content.substring(0, 50) + (dto.content.length > 50 ? '...' : ''),
        );

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
        if (content.startsWith(DISPUTE_EVENT_PREFIX)) {
            throw new BadRequestException('This message format is reserved for CarMazium dispute events.');
        }

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

        const routing = await this.resolveMessageRouting(room, senderId);
        await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: {
                updatedAt: new Date(),
                ...routing.roomUpdate,
            },
        });

        const preview = content
            ? `Photo: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`
            : 'You received a photo.';

        await this.notifyMessageRecipients(
            routing.recipients,
            roomId,
            message.id,
            'New Photo',
            preview,
            { hasAttachment: true },
        );

        return {
            message: await this.chatAttachmentService.hydrateMessage(message),
            created: true,
        };
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(roomId: string, userId: string): Promise<number> {
        const room: any = await this.getRoom(roomId, userId);
        const role = await this.actorRole(userId);

        if (room.context === ChatContext.DISPUTE) {
            if (!room.disputeCase) {
                throw new ForbiddenException('This dispute conversation is missing its case record.');
            }

            const readState = await this.prisma.disputeReadState.findUnique({
                where: {
                    disputeId_userId: {
                        disputeId: room.disputeCase.id,
                        userId,
                    },
                },
                select: { lastReadAt: true },
            });
            const markedCount = await this.prisma.message.count({
                where: {
                    chatRoomId: roomId,
                    senderId: { not: userId },
                    deletedAt: null,
                    ...(readState?.lastReadAt
                        ? { createdAt: { gt: readState.lastReadAt } }
                        : {}),
                },
            });

            await this.prisma.disputeReadState.upsert({
                where: {
                    disputeId_userId: {
                        disputeId: room.disputeCase.id,
                        userId,
                    },
                },
                update: { lastReadAt: new Date() },
                create: {
                    disputeId: room.disputeCase.id,
                    userId,
                    lastReadAt: new Date(),
                },
            });
            return markedCount;
        }

        const customerId = this.supportCustomerId(room);

        // In a multi-agent SUPPORT room, an admin opening the thread must only
        // mark customer-authored messages as read. Otherwise an agent could
        // accidentally mark a CarMazium reply as "read" on the customer's behalf.
        const senderFilter = room.context === ChatContext.SUPPORT
            && role === UserRole.ADMIN
            && customerId
            ? customerId
            : { not: userId };

        const result = await this.prisma.message.updateMany({
            where: {
                chatRoomId: roomId,
                senderId: senderFilter as any,
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
        const rooms = await this.getUserRooms(userId);
        return rooms.reduce((total, room) => total + Number(room.unreadCount || 0), 0);
    }

    /**
     * Get room IDs for a user (for WebSocket room joining)
     */
    async getUserRoomIds(userId: string): Promise<string[]> {
        const role = await this.actorRole(userId);
        const rooms = await this.prisma.chatRoom.findMany({
            where: {
                OR: role === UserRole.ADMIN
                    ? [
                        { context: ChatContext.SUPPORT },
                        {
                            context: ChatContext.DISPUTE,
                            disputeCase: { is: { joinedAdminId: userId } },
                        },
                        { initiatorId: userId },
                        { participantId: userId },
                    ]
                    : [
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
