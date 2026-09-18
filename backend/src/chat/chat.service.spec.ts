import { ForbiddenException } from '@nestjs/common';
import { ChatContext } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService — conversation context and authorization', () => {
    const buyerId = '11111111-1111-4111-8111-111111111111';
    const sellerId = '22222222-2222-4222-8222-222222222222';
    const otherBuyerId = '33333333-3333-4333-8333-333333333333';
    const listingId = '44444444-4444-4444-8444-444444444444';
    const auctionId = '55555555-5555-4555-8555-555555555555';

    let prisma: any;
    let notificationsService: any;
    let notificationsGateway: any;
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
            },
            listing: {
                findUnique: jest.fn(),
            },
            chatRoom: {
                findUnique: jest.fn().mockResolvedValue(null),
                upsert: jest.fn(),
                update: jest.fn(),
                findMany: jest.fn(),
            },
            message: {
                create: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
                updateMany: jest.fn(),
            },
        };
        notificationsService = { create: jest.fn() };
        notificationsGateway = { sendNotification: jest.fn() };
        service = new ChatService(prisma, notificationsService, notificationsGateway);
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
