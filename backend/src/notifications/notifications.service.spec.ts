import { NotificationsService } from './notifications.service';

describe('NotificationsService — push routing metadata', () => {
    it('includes canonical notification routing fields in the Expo payload', async () => {
        const gateway = {
            sendNotification: jest.fn(),
            isUserConnected: jest.fn().mockReturnValue(false),
        };
        const moduleRef = {
            get: jest.fn().mockReturnValue(gateway),
        } as any;
        const prisma = {
            notification: {
                create: jest.fn().mockResolvedValue({
                    id: 'notif-1',
                    userId: 'user-1',
                    type: 'AUCTION_WON',
                }),
            },
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    preferences: {
                        expoPushToken: 'ExponentPushToken[test-token]',
                        notifications: {
                            push: true,
                        },
                    },
                }),
            },
        } as any;

        const service = new NotificationsService(prisma, moduleRef);
        const pushSpy = jest
            .spyOn(service as any, 'pushToExpo')
            .mockResolvedValue(undefined);

        await service.create({
            userId: 'user-1',
            type: 'AUCTION_WON',
            title: 'You won',
            message: 'Pay the buyer fee to continue.',
            entityType: 'AUCTION',
            entityId: 'auction-1',
            actionType: 'OPEN',
            link: '/dashboard/dealer/auctions/won',
            data: {
                auctionId: 'auction-1',
                listingId: 'listing-1',
            },
        });

        expect(pushSpy).toHaveBeenCalledWith(
            'ExponentPushToken[test-token]',
            expect.objectContaining({
                title: 'You won',
                body: 'Pay the buyer fee to continue.',
                data: expect.objectContaining({
                    type: 'AUCTION_WON',
                    entityType: 'AUCTION',
                    entityId: 'auction-1',
                    actionType: 'OPEN',
                    link: '/dashboard/dealer/auctions/won',
                    auctionId: 'auction-1',
                    listingId: 'listing-1',
                    notifId: 'notif-1',
                }),
            }),
        );
    });
});
