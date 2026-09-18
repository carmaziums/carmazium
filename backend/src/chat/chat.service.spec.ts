import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatContext } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService — conversation context and authorization', () => {
    const buyerId = '11111111-1111-4111-8111-111111111111';
    const sellerId = '22222222-2222-4222-8222-222222222222';
    const otherBuyerId = '33333333-3333-4333-8333-333333333333';
    const listingId = '44444444-4444-4444-8444-444444444444';
    const auctionId = '55555555-5555-4555-8555-555555555555';
    const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const secondAdminId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    let prisma: any;
    let notificationsService: any;
    let notificationsGateway: any;
    let chatAttachmentService: any;
    let service: ChatService;

    const users = (first = buyerId, second = sellerId) => ([
        { id: first, role: first === sellerId ? 'SELLER' : 'BUYER' },
        { id: second, role: second === sellerId ? 'SELLER' : 'BUYER' },
    ]);

    const auctionListing = (overrides: Record<string, any> = {}) => ({
        id: listingId,
        sellerId,
        type: 'AUCTION',
        status: 'SOLD',
        deletedAt: null,
        auction: {
            id: auctionId,
            status: 'ENDED',
            winnerId: buyerId,
            buyerFeePaid: true,
        },
        offers: [],
        sale: { buyerId },
        ...overrides,
    });

    const retailListing = (overrides: Record<string, any> = {}) => ({
        id: listingId,
        sellerId,
        type: 'CLASSIFIED',
        status: 'ACTIVE',
        deletedAt: null,
        auction: null,
        offers: [],
        sale: null,
        ...overrides,
    });

    beforeEach(() => {
        prisma = {
            user: {
                findMany: jest.fn().mockResolvedValue(users()),
                findFirst: jest.fn(),
                findUnique: jest.fn().mockImplementation(({ where }: any) => {
                    const id = where.id;
                    if (id === adminId || id === secondAdminId) {
                        return Promise.resolve({ id, role: 'ADMIN', deletedAt: null });
                    }
                    if (id === sellerId) {
                        return Promise.resolve({ id, role: 'SELLER', deletedAt: null });
                    }
                    return Promise.resolve({ id, role: 'BUYER', deletedAt: null });
                }),
            },
            listing: {
                findUnique: jest.fn(),
            },
            chatRoom: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
                findMany: jest.fn(),
            },
            disputeCase: {
                findUnique: jest.fn(),
                create: jest.fn(),
                updateMany: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
            },
            disputeReadState: {
                findUnique: jest.fn(),
                createMany: jest.fn(),
                upsert: jest.fn(),
            },
            chatBlock: {
                findUnique: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
            },
            chatReport: {
                findUnique: jest.fn(),
                create: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            message: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                count: jest.fn(),
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn(),
                updateMany: jest.fn(),
            },
        };
        prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
        notificationsService = { create: jest.fn().mockResolvedValue({ id: 'notification' }) };
        notificationsGateway = { sendNotification: jest.fn() };
        chatAttachmentService = {
            hydrateMessages: jest.fn(async (messages: any[]) => messages),
            hydrateMessage: jest.fn(async (message: any) => ({ ...message, attachmentUrl: null })),
            validateMetadata: jest.fn(),
            assertPathOwnership: jest.fn(),
            assertUploaded: jest.fn(),
        };
        service = new ChatService(
            prisma,
            notificationsService,
            notificationsGateway,
            chatAttachmentService,
        );
    });

    it('blocks auction room creation until the auction has ended and the winner fee is paid', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            auctionListing({ auction: { id: auctionId, status: 'ACTIVE', winnerId: null, buyerFeePaid: false } }),
        );

        await expect(
            service.findOrCreateRoom(buyerId, { participantId: sellerId, listingId }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.chatRoom.upsert).not.toHaveBeenCalled();
    });

    it('blocks a non-winner from creating an auction room even after the fee is paid', async () => {
        prisma.user.findMany.mockResolvedValue(users(otherBuyerId, sellerId));
        prisma.listing.findUnique.mockResolvedValue(auctionListing());

        await expect(
            service.findOrCreateRoom(otherBuyerId, { participantId: sellerId, listingId }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/winner and seller/i) });

        expect(prisma.chatRoom.upsert).not.toHaveBeenCalled();
    });

    it('creates one auction context for the paid winner and seller', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing());
        prisma.chatRoom.upsert.mockImplementation(({ create }: any) => Promise.resolve({
            id: 'room-1',
            ...create,
            deletedAt: null,
            initiator: { id: buyerId },
            participant: { id: sellerId },
            listing: { id: listingId },
        }));

        const room = await service.findOrCreateRoom(
            buyerId,
            { participantId: sellerId, listingId },
        );

        expect(prisma.chatRoom.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    conversationKey: `AUCTION:${auctionId}:${buyerId}:${sellerId}`,
                },
                create: expect.objectContaining({
                    context: ChatContext.AUCTION,
                    listingId,
                }),
            }),
        );
        expect(room.id).toBe('room-1');
    });

    it('requires a retail vehicle conversation to include the actual listing seller', async () => {
        prisma.user.findMany.mockResolvedValue(users(buyerId, otherBuyerId));
        prisma.listing.findUnique.mockResolvedValue(retailListing());

        await expect(
            service.findOrCreateRoom(buyerId, { participantId: otherBuyerId, listingId }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/listing seller/i) });

        expect(prisma.chatRoom.upsert).not.toHaveBeenCalled();
    });

    it('lets only the accepted retail buyer continue once the listing is sale pending', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            retailListing({
                status: 'OFFER_ACCEPTED',
                offers: [{ buyerId }],
            }),
        );
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-1',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
        });

        await expect(service.assertCanMessageRoom('room-1', buyerId)).resolves.toBeDefined();

        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-2',
            initiatorId: otherBuyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
        });
        prisma.listing.findUnique.mockResolvedValue(
            retailListing({
                status: 'OFFER_ACCEPTED',
                offers: [{ buyerId }],
            }),
        );

        await expect(
            service.assertCanMessageRoom('room-2', otherBuyerId),
        ).rejects.toMatchObject({ message: expect.stringMatching(/accepted buyer/i) });
    });

    it('rechecks auction authorization before persisting every message', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-1',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.AUCTION,
            deletedAt: null,
        });
        prisma.listing.findUnique.mockResolvedValue(
            auctionListing({
                auction: { id: auctionId, status: 'ENDED', winnerId: buyerId, buyerFeePaid: false },
            }),
        );

        await expect(
            service.sendMessage('room-1', buyerId, { content: 'Can we arrange collection?' }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/paid the £125/i) });

        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('reuses the same persisted message when a client retries with the same idempotency key', async () => {
        const clientMessageId = '77777777-7777-4777-8777-777777777777';
        const savedMessage = {
            id: 'message-1',
            chatRoomId: 'room-1',
            senderId: buyerId,
            clientMessageId,
            content: 'Is collection tomorrow okay?',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            isRead: false,
            sender: { id: buyerId },
        };

        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-1',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });
        prisma.listing.findUnique.mockResolvedValue(retailListing());
        prisma.message.findFirst.mockResolvedValue(savedMessage);

        const result = await service.sendMessage('room-1', buyerId, {
            content: savedMessage.content,
            clientMessageId,
        });

        expect(result).toEqual({ message: savedMessage, created: false });
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.chatRoom.update).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('creates and notifies only once across a first send and an immediate retry', async () => {
        const clientMessageId = '88888888-8888-4888-8888-888888888888';
        const savedMessage = {
            id: 'message-2',
            chatRoomId: 'room-1',
            senderId: buyerId,
            clientMessageId,
            content: 'Please confirm the address.',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            isRead: false,
            sender: { id: buyerId },
        };

        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-1',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });
        prisma.listing.findUnique.mockResolvedValue(retailListing());
        prisma.message.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(savedMessage);
        prisma.message.create.mockResolvedValue(savedMessage);
        prisma.chatRoom.update.mockResolvedValue({});
        notificationsService.create.mockResolvedValue({ id: 'notification-1' });

        const first = await service.sendMessage('room-1', buyerId, {
            content: savedMessage.content,
            clientMessageId,
        });
        const retry = await service.sendMessage('room-1', buyerId, {
            content: savedMessage.content,
            clientMessageId,
        });

        expect(first.created).toBe(true);
        expect(retry.created).toBe(false);
        expect(prisma.message.create).toHaveBeenCalledTimes(1);
        expect(prisma.chatRoom.update).toHaveBeenCalledTimes(1);
        expect(notificationsService.create).toHaveBeenCalledTimes(1);
        expect(notificationsGateway.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('loads older messages with a stable createdAt/id cursor', async () => {
        const before = new Date('2026-09-18T12:00:00.000Z');
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-1',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { id: buyerId },
            participant: { id: sellerId },
            listing: { id: listingId },
        });

        const rows = [
            { id: 'm4', createdAt: new Date('2026-09-18T11:00:00.000Z') },
            { id: 'm3', createdAt: new Date('2026-09-18T10:00:00.000Z') },
            { id: 'm2', createdAt: new Date('2026-09-18T09:00:00.000Z') },
        ];
        prisma.message.findMany.mockResolvedValue(rows);
        prisma.message.count.mockResolvedValue(5);

        const result = await service.getRoomMessages(
            'room-1',
            buyerId,
            1,
            2,
            before,
            'cursor-message',
        );

        expect(prisma.message.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 3,
                skip: 0,
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
                where: expect.objectContaining({
                    chatRoomId: 'room-1',
                    OR: [
                        { createdAt: { lt: before } },
                        { createdAt: before, id: { lt: 'cursor-message' } },
                    ],
                }),
            }),
        );
        expect(result.data.map((message: any) => message.id)).toEqual(['m3', 'm4']);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).toEqual({
            createdAt: '2026-09-18T10:00:00.000Z',
            id: 'm3',
        });
    });

    it('routes normal message notifications to the recipient account inbox', async () => {
        const savedMessage = {
            id: 'message-route',
            chatRoomId: 'room-route',
            senderId: buyerId,
            clientMessageId: null,
            content: 'Hello seller',
            attachmentPath: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            isRead: false,
            sender: { id: buyerId },
        };

        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-route',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });
        prisma.listing.findUnique.mockResolvedValue(retailListing());
        prisma.message.create.mockResolvedValue(savedMessage);
        prisma.chatRoom.update.mockResolvedValue({});
        notificationsService.create.mockResolvedValue({ id: 'notification-route' });

        await service.sendMessage('room-route', buyerId, {
            content: savedMessage.content,
        });

        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: sellerId,
                link: '/dashboard/seller/messages?room=room-route',
            }),
        );
    });

    it('persists a private photo only after room authorization and upload verification', async () => {
        const clientMessageId = '99999999-9999-4999-8999-999999999999';
        const dto = {
            path: `room-photo/${buyerId}/photo.jpg`,
            name: 'damage.jpg',
            mime: 'image/jpeg',
            size: 123456,
            caption: 'Rear bumper damage',
            clientMessageId,
        };
        const stored = {
            id: 'message-photo',
            chatRoomId: 'room-photo',
            senderId: buyerId,
            clientMessageId,
            content: dto.caption,
            attachmentPath: dto.path,
            attachmentName: dto.name,
            attachmentMime: dto.mime,
            attachmentSize: dto.size,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            isRead: false,
            sender: { id: buyerId },
        };

        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'room-photo',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });
        prisma.listing.findUnique.mockResolvedValue(retailListing());
        prisma.message.findFirst.mockResolvedValue(null);
        prisma.message.create.mockResolvedValue(stored);
        prisma.chatRoom.update.mockResolvedValue({});
        notificationsService.create.mockResolvedValue({ id: 'notification-photo' });
        chatAttachmentService.hydrateMessage.mockImplementation(
            async (message: any) => ({ ...message, attachmentUrl: 'https://signed.example/photo' }),
        );

        const result = await service.sendAttachmentMessage(
            'room-photo',
            buyerId,
            dto,
        );

        expect(chatAttachmentService.validateMetadata).toHaveBeenCalledWith(
            dto.name,
            dto.mime,
            dto.size,
        );
        expect(chatAttachmentService.assertPathOwnership).toHaveBeenCalledWith(
            dto.path,
            'room-photo',
            buyerId,
        );
        expect(chatAttachmentService.assertUploaded).toHaveBeenCalledWith(dto.path);
        expect(prisma.message.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    attachmentPath: dto.path,
                    attachmentName: dto.name,
                    attachmentMime: dto.mime,
                    attachmentSize: dto.size,
                }),
            }),
        );
        expect(result.created).toBe(true);
        expect(result.message.attachmentUrl).toBe('https://signed.example/photo');
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                link: '/dashboard/seller/messages?room=room-photo',
                title: 'New Photo',
            }),
        );
    });

    it('uses one permanent support key per customer regardless of which admin opens it', async () => {
        prisma.user.findMany
            .mockResolvedValueOnce([
                { id: buyerId, role: 'BUYER' },
                { id: adminId, role: 'ADMIN' },
            ])
            .mockResolvedValueOnce([
                { id: secondAdminId, role: 'ADMIN' },
                { id: buyerId, role: 'BUYER' },
            ]);
        prisma.chatRoom.findUnique.mockResolvedValue(null);
        prisma.chatRoom.upsert.mockImplementation(({ create }: any) => Promise.resolve({
            id: 'support-room',
            ...create,
            deletedAt: null,
            initiator: { id: create.initiatorId, role: create.initiatorId === buyerId ? 'BUYER' : 'ADMIN' },
            participant: { id: create.participantId, role: create.participantId === buyerId ? 'BUYER' : 'ADMIN' },
            listing: null,
            supportAssignedAdmin: null,
        }));

        await service.findOrCreateRoom(buyerId, { participantId: adminId });
        await service.findOrCreateRoom(secondAdminId, { participantId: buyerId });

        const firstKey = prisma.chatRoom.upsert.mock.calls[0][0].where.conversationKey;
        const secondKey = prisma.chatRoom.upsert.mock.calls[1][0].where.conversationKey;

        expect(firstKey).toBe(`SUPPORT:CARMAZIUM:${buyerId}`);
        expect(secondKey).toBe(firstKey);
        expect(prisma.chatRoom.upsert.mock.calls[0][0].create.supportAssignedAdminId).toBe(adminId);
    });

    it('does not expose internal support assignment or tags to the member room payload', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'support-room',
            initiatorId: buyerId,
            participantId: adminId,
            listingId: null,
            context: ChatContext.SUPPORT,
            conversationKey: `SUPPORT:CARMAZIUM:${buyerId}`,
            supportAssignedAdminId: secondAdminId,
            supportAssignedAdmin: {
                id: secondAdminId,
                firstName: 'Support',
                lastName: 'Agent',
                email: 'private@carmazium.test',
            },
            supportTags: ['refund', 'urgent'],
            supportClosedAt: new Date(),
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: adminId, role: 'ADMIN' },
            disputeCase: null,
            blocks: [],
            listing: null,
        });

        const room = await service.getRoom('support-room', buyerId);

        expect(room).not.toHaveProperty('supportAssignedAdmin');
        expect(room).not.toHaveProperty('supportAssignedAdminId');
        expect(room).not.toHaveProperty('supportTags');
        expect(room).not.toHaveProperty('supportClosedAt');
    });

    it('removes dispute participant and joined-admin emails from member room payloads', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            conversationKey: 'DISPUTE:source-room',
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            blocks: [],
            listing: null,
            disputeCase: {
                id: 'dispute-1',
                joinedAdminId: adminId,
                buyer: { id: buyerId, firstName: 'Buyer', email: 'buyer@example.test' },
                seller: { id: sellerId, firstName: 'Seller', email: 'seller@example.test' },
                joinedAdmin: { id: adminId, firstName: 'Admin', email: 'admin@carmazium.test' },
            },
        });

        const room = await service.getRoom('dispute-room', buyerId);

        expect(room.disputeCase.buyer).not.toHaveProperty('email');
        expect(room.disputeCase.seller).not.toHaveProperty('email');
        expect(room.disputeCase.joinedAdmin).not.toHaveProperty('email');
    });

    it('allows another admin into SUPPORT but not into a private retail room', async () => {
        prisma.chatRoom.findUnique.mockResolvedValueOnce({
            id: 'support-room',
            initiatorId: buyerId,
            participantId: adminId,
            listingId: null,
            context: ChatContext.SUPPORT,
            supportAssignedAdminId: adminId,
            supportClosedAt: null,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'ADMIN' },
        });

        await expect(
            service.assertCanMessageRoom('support-room', secondAdminId),
        ).resolves.toBeDefined();

        prisma.chatRoom.findUnique.mockResolvedValueOnce({
            id: 'retail-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            supportAssignedAdminId: null,
            supportClosedAt: null,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });

        await expect(
            service.assertCanMessageRoom('retail-room', secondAdminId),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('applies a stable updatedAt/id cursor when a room page is requested', async () => {
        const before = new Date('2026-09-18T12:00:00.000Z');
        prisma.chatRoom.findMany.mockResolvedValue([]);

        await service.getUserRooms(buyerId, {
            limit: 51,
            before,
            beforeId: 'aaaaaaaa-0000-4000-8000-000000000000',
        });

        expect(prisma.chatRoom.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 51,
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' },
                ],
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                { updatedAt: { lt: before } },
                                {
                                    updatedAt: before,
                                    id: { lt: 'aaaaaaaa-0000-4000-8000-000000000000' },
                                },
                            ]),
                        }),
                    ]),
                }),
            }),
        );
    });

    it('excludes actively blocked rooms from realtime room membership', async () => {
        prisma.chatRoom.findMany.mockResolvedValue([]);

        await service.getUserRoomIds(buyerId);

        expect(prisma.chatRoom.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    blocks: { none: { revokedAt: null } },
                }),
            }),
        );
    });

    it('batches unread counts for non-dispute rooms instead of counting once per room', async () => {
        prisma.chatRoom.findMany.mockResolvedValue([
            {
                id: 'support-room-1',
                initiatorId: buyerId,
                participantId: adminId,
                context: ChatContext.SUPPORT,
                conversationKey: `SUPPORT:CARMAZIUM:${buyerId}`,
                supportAssignedAdminId: adminId,
                supportAssignedAdmin: null,
                supportTags: [],
                supportClosedAt: null,
                deletedAt: null,
                initiator: { id: buyerId, role: 'BUYER' },
                participant: { id: adminId, role: 'ADMIN' },
                disputeCase: null,
                disputeAsSource: null,
                blocks: [],
                listing: null,
                messages: [],
                updatedAt: new Date(),
            },
            {
                id: 'support-room-2',
                initiatorId: otherBuyerId,
                participantId: adminId,
                context: ChatContext.SUPPORT,
                conversationKey: `SUPPORT:CARMAZIUM:${otherBuyerId}`,
                supportAssignedAdminId: adminId,
                supportAssignedAdmin: null,
                supportTags: [],
                supportClosedAt: null,
                deletedAt: null,
                initiator: { id: otherBuyerId, role: 'BUYER' },
                participant: { id: adminId, role: 'ADMIN' },
                disputeCase: null,
                disputeAsSource: null,
                blocks: [],
                listing: null,
                messages: [],
                updatedAt: new Date(),
            },
        ]);
        prisma.message.groupBy.mockResolvedValue([
            { chatRoomId: 'support-room-1', senderId: buyerId, _count: { _all: 2 } },
            { chatRoomId: 'support-room-2', senderId: otherBuyerId, _count: { _all: 3 } },
        ]);

        const rooms = await service.getUserRooms(adminId);

        expect(rooms.map((room) => room.unreadCount)).toEqual([2, 3]);
        expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.message.count).not.toHaveBeenCalled();
    });

    it('marks only customer-authored support messages read when another admin opens the thread', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'support-room',
            initiatorId: buyerId,
            participantId: adminId,
            listingId: null,
            context: ChatContext.SUPPORT,
            supportAssignedAdminId: adminId,
            supportClosedAt: null,
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: adminId, role: 'ADMIN' },
            listing: null,
            supportAssignedAdmin: { id: adminId },
        });
        prisma.message.updateMany.mockResolvedValue({ count: 2 });

        const count = await service.markMessagesAsRead('support-room', secondAdminId);

        expect(count).toBe(2);
        expect(prisma.message.updateMany).toHaveBeenCalledWith({
            where: {
                chatRoomId: 'support-room',
                senderId: buyerId,
                isRead: false,
            },
            data: { isRead: true },
        });
    });

    it('routes a customer support reply to the assigned admin', async () => {
        const savedMessage = {
            id: 'support-message',
            chatRoomId: 'support-room',
            senderId: buyerId,
            content: 'I still need help',
            deletedAt: null,
            sender: { id: buyerId },
        };
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'support-room',
            initiatorId: buyerId,
            participantId: adminId,
            listingId: null,
            context: ChatContext.SUPPORT,
            supportAssignedAdminId: secondAdminId,
            supportClosedAt: null,
            deletedAt: null,
            initiator: { role: 'BUYER' },
            participant: { role: 'ADMIN' },
        });
        prisma.message.create.mockResolvedValue(savedMessage);
        prisma.chatRoom.update.mockResolvedValue({});
        notificationsService.create.mockResolvedValue({ id: 'support-notification' });

        await service.sendMessage('support-room', buyerId, {
            content: savedMessage.content,
        });

        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: secondAdminId,
                link: '/dashboard/admin/messages?room=support-room',
            }),
        );
        expect(prisma.chatRoom.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ supportClosedAt: null }),
            }),
        );
    });

    it('opens a separate dispute room only after a retail transaction reaches sale pending or sold', async () => {
        const sourceRoom = {
            id: 'retail-source',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: {
                id: listingId,
                title: 'Ford Fiesta',
                sellerId,
                status: 'SOLD',
            },
        };
        const disputeRoom = {
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            conversationKey: 'DISPUTE:retail-source',
            deletedAt: null,
        };
        const dispute = {
            id: 'dispute-1',
            sourceRoomId: sourceRoom.id,
            chatRoomId: disputeRoom.id,
            listingId,
            buyerId,
            sellerId,
            openedById: buyerId,
            joinedAdminId: null,
            status: 'OPEN',
        };
        const hydratedRoom = {
            ...disputeRoom,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: sourceRoom.listing,
            disputeCase: {
                ...dispute,
                buyer: { id: buyerId, role: 'BUYER' },
                seller: { id: sellerId, role: 'SELLER' },
                joinedAdmin: null,
            },
            disputeAsSource: null,
        };
        const eventMessage = {
            id: 'event-opened',
            chatRoomId: disputeRoom.id,
            senderId: buyerId,
            content: '__CARMAZIUM_DISPUTE_EVENT_V1__:{"type":"OPENED","disputeId":"dispute-1","reason":"Vehicle fault"}',
            sender: { id: buyerId },
        };

        prisma.chatRoom.findUnique
            .mockResolvedValueOnce(sourceRoom)
            .mockResolvedValueOnce(hydratedRoom);
        prisma.disputeCase.findUnique.mockResolvedValue(null);
        prisma.chatRoom.create.mockResolvedValue(disputeRoom);
        prisma.disputeCase.create.mockResolvedValue(dispute);
        prisma.disputeReadState.createMany.mockResolvedValue({ count: 2 });
        prisma.message.create.mockResolvedValue(eventMessage);
        prisma.chatRoom.update.mockResolvedValue({});
        prisma.user.findMany.mockResolvedValue([{ id: adminId }]);

        const result = await service.openDispute(
            sourceRoom.id,
            buyerId,
            { reason: ' Vehicle fault ' },
        );

        expect(result.created).toBe(true);
        expect(result.room.id).toBe(disputeRoom.id);
        expect(prisma.chatRoom.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                initiatorId: buyerId,
                participantId: sellerId,
                listingId,
                context: ChatContext.DISPUTE,
                conversationKey: `DISPUTE:${sourceRoom.id}`,
            }),
        });
        expect(prisma.disputeCase.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                sourceRoomId: sourceRoom.id,
                chatRoomId: disputeRoom.id,
                buyerId,
                sellerId,
                openedById: buyerId,
                reason: 'Vehicle fault',
            }),
        });
        expect(prisma.disputeReadState.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ disputeId: dispute.id, userId: buyerId }),
                expect.objectContaining({ disputeId: dispute.id, userId: sellerId }),
            ]),
        });
        expect(eventMessage.content).toContain('"type":"OPENED"');
    });

    it('blocks a dispute while a retail listing is still only active', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'retail-source',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: {
                id: listingId,
                title: 'Ford Fiesta',
                sellerId,
                status: 'ACTIVE',
            },
        });

        await expect(
            service.openDispute('retail-source', buyerId, { reason: 'Too early' }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.chatRoom.create).not.toHaveBeenCalled();
        expect(prisma.disputeCase.create).not.toHaveBeenCalled();
    });

    it('does not let an unjoined admin read a dispute room', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            disputeCase: {
                id: 'dispute-1',
                status: 'OPEN',
                joinedAdminId: adminId,
            },
        });

        await expect(
            service.getRoom('dispute-room', secondAdminId),
        ).rejects.toBeInstanceOf(ForbiddenException);

        await expect(
            service.getRoom('dispute-room', adminId),
        ).resolves.toBeDefined();
    });

    it('allows only one admin to explicitly claim a dispute', async () => {
        prisma.disputeCase.findUnique.mockResolvedValue({
            id: 'dispute-1',
            chatRoomId: 'dispute-room',
            status: 'OPEN',
            joinedAdminId: adminId,
        });

        await expect(
            service.joinDispute('dispute-1', secondAdminId),
        ).rejects.toMatchObject({ message: expect.stringMatching(/already assigned/i) });

        expect(prisma.disputeCase.updateMany).not.toHaveBeenCalled();
    });

    it('writes a visible audit event when an admin joins an unassigned dispute', async () => {
        const claimed = {
            id: 'dispute-1',
            chatRoomId: 'dispute-room',
            buyerId,
            sellerId,
            status: 'OPEN',
            joinedAdminId: adminId,
        };
        const room = {
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            disputeCase: {
                ...claimed,
                buyer: { id: buyerId, role: 'BUYER' },
                seller: { id: sellerId, role: 'SELLER' },
                joinedAdmin: { id: adminId, role: 'ADMIN' },
            },
        };
        prisma.disputeCase.findUnique
            .mockResolvedValueOnce({
                ...claimed,
                joinedAdminId: null,
            })
            .mockResolvedValueOnce(claimed);
        prisma.disputeCase.updateMany.mockResolvedValue({ count: 1 });
        prisma.disputeReadState.upsert.mockResolvedValue({});
        prisma.message.create.mockResolvedValue({
            id: 'join-event',
            chatRoomId: 'dispute-room',
            senderId: adminId,
            content: '__CARMAZIUM_DISPUTE_EVENT_V1__:{"type":"ADMIN_JOINED","disputeId":"dispute-1"}',
        });
        prisma.chatRoom.update.mockResolvedValue({});
        prisma.chatRoom.findUnique.mockResolvedValue(room);

        const result = await service.joinDispute('dispute-1', adminId);

        expect(result.joined).toBe(true);
        expect(prisma.disputeCase.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    joinedAdminId: null,
                    status: 'OPEN',
                }),
                data: expect.objectContaining({
                    joinedAdminId: adminId,
                    adminJoinedAt: expect.any(Date),
                }),
            }),
        );
        expect(prisma.message.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    senderId: adminId,
                    content: expect.stringContaining('"type":"ADMIN_JOINED"'),
                }),
            }),
        );
    });

    it('routes a dispute message to both the other party and the joined admin', async () => {
        const room = {
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            disputeCase: {
                id: 'dispute-1',
                status: 'OPEN',
                joinedAdminId: adminId,
            },
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        };
        const saved = {
            id: 'dispute-message',
            chatRoomId: room.id,
            senderId: buyerId,
            content: 'The fault is still present.',
            deletedAt: null,
            sender: { id: buyerId },
        };
        prisma.chatRoom.findUnique.mockResolvedValue(room);
        prisma.message.create.mockResolvedValue(saved);
        prisma.chatRoom.update.mockResolvedValue({});

        await service.sendMessage(room.id, buyerId, { content: saved.content });

        expect(notificationsService.create).toHaveBeenCalledTimes(2);
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: sellerId }),
        );
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: adminId,
                link: `/dashboard/admin/messages?room=${room.id}`,
            }),
        );
    });

    it('rejects client attempts to forge dispute audit events', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            disputeCase: {
                id: 'dispute-1',
                status: 'OPEN',
                joinedAdminId: adminId,
            },
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });

        await expect(
            service.sendMessage('dispute-room', buyerId, {
                content: '__CARMAZIUM_DISPUTE_EVENT_V1__:{"type":"RESOLVED"}',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('uses a per-user read cursor for disputes instead of the two-party isRead flag', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            disputeCase: {
                id: 'dispute-1',
                status: 'OPEN',
                joinedAdminId: adminId,
            },
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
        });
        prisma.disputeReadState.findUnique.mockResolvedValue({
            lastReadAt: new Date('2026-09-18T10:00:00.000Z'),
        });
        prisma.message.count.mockResolvedValue(3);
        prisma.disputeReadState.upsert.mockResolvedValue({});

        const marked = await service.markMessagesAsRead('dispute-room', buyerId);

        expect(marked).toBe(3);
        expect(prisma.disputeReadState.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    disputeId_userId: {
                        disputeId: 'dispute-1',
                        userId: buyerId,
                    },
                },
                update: { lastReadAt: expect.any(Date) },
            }),
        );
        expect(prisma.message.updateMany).not.toHaveBeenCalled();
    });

    it('makes a resolved dispute read-only', async () => {
        prisma.chatRoom.findUnique.mockResolvedValue({
            id: 'dispute-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.DISPUTE,
            deletedAt: null,
            disputeCase: {
                id: 'dispute-1',
                status: 'RESOLVED',
                joinedAdminId: adminId,
            },
            initiator: { role: 'BUYER' },
            participant: { role: 'SELLER' },
        });

        await expect(
            service.sendMessage('dispute-room', buyerId, { content: 'One more message' }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/read-only/i) });

        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('makes a blocked retail conversation read-only for both participants without hiding history', async () => {
        const blockedRoom = {
            id: 'blocked-room',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            blocks: [{
                id: 'block-1',
                blockerId: buyerId,
                blockedUserId: sellerId,
                reason: 'No more direct contact',
                createdAt: new Date(),
            }],
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: { id: listingId, status: 'SOLD' },
        };
        prisma.chatRoom.findUnique.mockResolvedValue(blockedRoom);

        await expect(
            service.sendMessage('blocked-room', buyerId, { content: 'buyer message' }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/blocked/i) });

        await expect(
            service.sendMessage('blocked-room', sellerId, { content: 'seller message' }),
        ).rejects.toMatchObject({ message: expect.stringMatching(/blocked/i) });

        const buyerView = await service.getRoom('blocked-room', buyerId);
        const sellerView = await service.getRoom('blocked-room', sellerId);

        expect(buyerView.chatBlocked).toBe(true);
        expect(buyerView.blockedByMe).toBe(true);
        expect(buyerView.blockReason).toBe('No more direct contact');
        expect((buyerView as any).blocks).toBeUndefined();
        expect(sellerView.chatBlocked).toBe(true);
        expect(sellerView.blockedByMe).toBe(false);
        expect(sellerView.blockReason).toBeNull();
        expect((sellerView as any).blocks).toBeUndefined();
        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('records a member block against only the other participant and can later revoke it', async () => {
        const openRoom = {
            id: 'room-safety',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            blocks: [],
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: { id: listingId, status: 'ACTIVE' },
        };
        const blockedRoom = {
            ...openRoom,
            blocks: [{
                id: 'block-1',
                blockerId: buyerId,
                blockedUserId: sellerId,
                reason: 'Unwanted contact',
                createdAt: new Date(),
            }],
        };

        prisma.chatRoom.findUnique
            .mockResolvedValueOnce(openRoom)
            .mockResolvedValueOnce(blockedRoom)
            .mockResolvedValueOnce(blockedRoom)
            .mockResolvedValueOnce(openRoom);
        prisma.chatBlock.upsert.mockResolvedValue({ id: 'block-1' });
        prisma.chatBlock.findUnique.mockResolvedValue({
            id: 'block-1',
            chatRoomId: openRoom.id,
            blockerId: buyerId,
            blockedUserId: sellerId,
            revokedAt: null,
        });
        prisma.chatBlock.update.mockResolvedValue({ id: 'block-1', revokedAt: new Date() });

        const blocked = await service.blockRoom(
            openRoom.id,
            buyerId,
            { reason: ' Unwanted contact ' },
        );

        expect(prisma.chatBlock.upsert).toHaveBeenCalledWith({
            where: {
                chatRoomId_blockerId_blockedUserId: {
                    chatRoomId: openRoom.id,
                    blockerId: buyerId,
                    blockedUserId: sellerId,
                },
            },
            update: {
                revokedAt: null,
                reason: 'Unwanted contact',
            },
            create: {
                chatRoomId: openRoom.id,
                blockerId: buyerId,
                blockedUserId: sellerId,
                reason: 'Unwanted contact',
            },
        });
        expect(blocked.blockedByMe).toBe(true);

        const unblocked = await service.unblockRoom(openRoom.id, buyerId);
        expect(prisma.chatBlock.update).toHaveBeenCalledWith({
            where: { id: 'block-1' },
            data: { revokedAt: expect.any(Date) },
        });
        expect(unblocked.chatBlocked).toBe(false);
    });

    it('reports exactly one received message using an immutable evidence snapshot', async () => {
        const message = {
            id: 'message-report',
            chatRoomId: 'room-report',
            senderId: sellerId,
            content: 'Send me money now.',
            attachmentPath: 'room-report/seller/photo.jpg',
            attachmentName: 'photo.jpg',
            attachmentMime: 'image/jpeg',
            attachmentSize: 1234,
            deletedAt: null,
            sender: {
                id: sellerId,
                firstName: 'Seller',
                lastName: 'User',
                email: 'seller@example.com',
                profileImage: null,
                role: 'SELLER',
            },
            chatRoom: {
                id: 'room-report',
                initiatorId: buyerId,
                participantId: sellerId,
                context: ChatContext.RETAIL,
                listingId,
                deletedAt: null,
                listing: { id: listingId, title: 'Ford Fiesta' },
            },
        };
        const room = {
            id: 'room-report',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            blocks: [],
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: { id: listingId, title: 'Ford Fiesta' },
        };
        const report = {
            id: 'report-1',
            chatRoomId: room.id,
            messageId: message.id,
            reporterId: buyerId,
            reportedUserId: sellerId,
            reason: 'SCAM_FRAUD',
            details: 'Asked for suspicious payment.',
            messageContent: message.content,
            attachmentPath: message.attachmentPath,
            attachmentName: message.attachmentName,
            attachmentMime: message.attachmentMime,
            attachmentSize: message.attachmentSize,
            roomContext: ChatContext.RETAIL,
            listingId,
            listingTitle: 'Ford Fiesta',
            status: 'OPEN',
            reporter: { id: buyerId, email: 'buyer@example.com' },
            reportedUser: { id: sellerId, email: 'seller@example.com', role: 'SELLER' },
            reviewedBy: null,
        };

        prisma.message.findUnique.mockResolvedValue(message);
        prisma.chatRoom.findUnique.mockResolvedValue(room);
        prisma.chatReport.findUnique.mockResolvedValue(null);
        prisma.chatReport.create.mockResolvedValue(report);
        prisma.user.findMany.mockResolvedValue([{ id: adminId }]);

        const result = await service.reportMessage(
            message.id,
            buyerId,
            {
                reason: 'SCAM_FRAUD' as any,
                details: ' Asked for suspicious payment. ',
            },
        );

        expect(result.created).toBe(true);
        expect(prisma.chatReport.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    chatRoomId: room.id,
                    messageId: message.id,
                    reporterId: buyerId,
                    reportedUserId: sellerId,
                    reason: 'SCAM_FRAUD',
                    details: 'Asked for suspicious payment.',
                    messageContent: message.content,
                    attachmentPath: message.attachmentPath,
                    attachmentName: message.attachmentName,
                    attachmentMime: message.attachmentMime,
                    attachmentSize: message.attachmentSize,
                    roomContext: ChatContext.RETAIL,
                    listingId,
                    listingTitle: 'Ford Fiesta',
                },
            }),
        );
        expect(prisma.message.findMany).not.toHaveBeenCalled();
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: adminId,
                link: '/dashboard/admin/messages?mode=moderation',
            }),
        );
    });

    it('returns an existing report instead of duplicating the same reporter/message evidence', async () => {
        const message = {
            id: 'message-report-existing',
            chatRoomId: 'room-report',
            senderId: sellerId,
            content: 'Repeated message',
            attachmentPath: null,
            attachmentName: null,
            attachmentMime: null,
            attachmentSize: null,
            deletedAt: null,
            sender: {
                id: sellerId,
                email: 'seller@example.com',
                role: 'SELLER',
            },
            chatRoom: {
                id: 'room-report',
                initiatorId: buyerId,
                participantId: sellerId,
                context: ChatContext.RETAIL,
                listingId,
                deletedAt: null,
                listing: { id: listingId, title: 'Ford Fiesta' },
            },
        };
        const room = {
            id: 'room-report',
            initiatorId: buyerId,
            participantId: sellerId,
            listingId,
            context: ChatContext.RETAIL,
            deletedAt: null,
            blocks: [],
            initiator: { id: buyerId, role: 'BUYER' },
            participant: { id: sellerId, role: 'SELLER' },
            listing: { id: listingId, title: 'Ford Fiesta' },
        };
        const existing = {
            id: 'report-existing',
            chatRoomId: room.id,
            messageId: message.id,
            reporterId: buyerId,
            reportedUserId: sellerId,
            reason: 'SPAM',
            messageContent: message.content,
            attachmentPath: null,
            reporter: { id: buyerId, email: 'buyer@example.com' },
            reportedUser: { id: sellerId, email: 'seller@example.com', role: 'SELLER' },
            reviewedBy: null,
        };

        prisma.message.findUnique.mockResolvedValue(message);
        prisma.chatRoom.findUnique.mockResolvedValue(room);
        prisma.chatReport.findUnique.mockResolvedValue(existing);

        const result = await service.reportMessage(
            message.id,
            buyerId,
            { reason: 'SPAM' as any },
        );

        expect(result.created).toBe(false);
        expect(result.report.id).toBe(existing.id);
        expect(prisma.chatReport.create).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('lists only report snapshots for moderators and does not read the private room transcript', async () => {
        prisma.chatReport.findMany.mockResolvedValue([{
            id: 'report-admin',
            chatRoomId: 'private-room',
            messageId: 'reported-message',
            reporterId: buyerId,
            reportedUserId: sellerId,
            reason: 'HARASSMENT',
            messageContent: 'Reported evidence only',
            attachmentPath: null,
            roomContext: ChatContext.RETAIL,
            status: 'OPEN',
            createdAt: new Date(),
            reporter: { id: buyerId, email: 'buyer@example.com' },
            reportedUser: { id: sellerId, email: 'seller@example.com', role: 'SELLER' },
            reviewedBy: null,
        }]);
        prisma.chatReport.count.mockResolvedValue(1);

        const result = await service.listChatReports(1, 30, 'OPEN');

        expect(result.data).toHaveLength(1);
        expect(result.data[0].messageContent).toBe('Reported evidence only');
        expect(prisma.message.findMany).not.toHaveBeenCalled();
        expect(prisma.chatRoom.findUnique).not.toHaveBeenCalled();
    });

    it('claims an open moderation report atomically for exactly one admin', async () => {
        const openReport = {
            id: 'report-claim',
            chatRoomId: 'private-room',
            reporterId: buyerId,
            reportedUserId: sellerId,
            status: 'OPEN',
            reviewedById: null,
        };
        const reviewingReport = {
            ...openReport,
            status: 'REVIEWING',
            reviewedById: adminId,
            reporter: { id: buyerId, email: 'buyer@example.com', role: 'BUYER' },
            reportedUser: { id: sellerId, email: 'seller@example.com', role: 'SELLER' },
            reviewedBy: { id: adminId, email: 'admin@example.com' },
        };

        prisma.chatReport.findUnique
            .mockResolvedValueOnce(openReport)
            .mockResolvedValueOnce(reviewingReport);
        prisma.chatReport.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.updateChatReport(
            openReport.id,
            adminId,
            { status: 'REVIEWING' as any },
        );

        expect(result.status).toBe('REVIEWING');
        expect(prisma.chatReport.updateMany).toHaveBeenCalledWith({
            where: {
                id: openReport.id,
                status: 'OPEN',
                reviewedById: null,
            },
            data: expect.objectContaining({
                status: 'REVIEWING',
                reviewedById: adminId,
                reviewedAt: expect.any(Date),
            }),
        });
    });

    it('rejects a losing moderation claim when another admin wins the race', async () => {
        const openReport = {
            id: 'report-race',
            chatRoomId: 'private-room',
            reporterId: buyerId,
            reportedUserId: sellerId,
            status: 'OPEN',
            reviewedById: null,
        };

        prisma.chatReport.findUnique
            .mockResolvedValueOnce(openReport)
            .mockResolvedValueOnce({
                status: 'REVIEWING',
                reviewedById: secondAdminId,
            });
        prisma.chatReport.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            service.updateChatReport(
                openReport.id,
                adminId,
                { status: 'REVIEWING' as any },
            ),
        ).rejects.toMatchObject({
            message: expect.stringMatching(/claimed by another admin/i),
        });
    });

    it('keeps closed moderation reports immutable', async () => {
        prisma.chatReport.findUnique.mockResolvedValue({
            id: 'report-closed',
            status: 'RESOLVED',
            reviewedById: adminId,
        });

        await expect(
            service.updateChatReport(
                'report-closed',
                secondAdminId,
                { status: 'RESOLVED' as any },
            ),
        ).rejects.toMatchObject({
            message: expect.stringMatching(/already been closed/i),
        });

        expect(prisma.chatReport.updateMany).not.toHaveBeenCalled();
        expect(prisma.chatReport.update).not.toHaveBeenCalled();
    });

    it('uses different conversation keys for different retail vehicles between the same users', async () => {
        const secondListingId = '66666666-6666-4666-8666-666666666666';
        prisma.listing.findUnique
            .mockResolvedValueOnce(retailListing())
            .mockResolvedValueOnce(retailListing({ id: secondListingId }));

        prisma.chatRoom.upsert.mockImplementation(({ create }: any) => Promise.resolve({
            id: `room-${create.listingId}`,
            ...create,
            deletedAt: null,
            initiator: { id: buyerId },
            participant: { id: sellerId },
            listing: { id: create.listingId },
        }));

        await service.findOrCreateRoom(buyerId, { participantId: sellerId, listingId });
        await service.findOrCreateRoom(buyerId, { participantId: sellerId, listingId: secondListingId });

        const firstKey = prisma.chatRoom.upsert.mock.calls[0][0].where.conversationKey;
        const secondKey = prisma.chatRoom.upsert.mock.calls[1][0].where.conversationKey;

        expect(firstKey).not.toBe(secondKey);
        expect(firstKey).toContain(listingId);
        expect(secondKey).toContain(secondListingId);
    });
});
