import { BadRequestException } from '@nestjs/common';
import {
    BroadcastCampaignStatus,
    BroadcastDeliveryStatus,
    CapabilityStatus,
    ServiceType,
    UserRole,
} from '@prisma/client';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminMediaKind, AdminMessageAudience } from './dto/admin-message.dto';

describe('AdminMessagingService', () => {
    const recipient = {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'member@example.com',
        firstName: 'Member',
        lastName: 'One',
        role: UserRole.BUYER,
    };

    const makeService = (users = [recipient]) => {
        const prisma = {
            user: {
                findMany: jest.fn().mockResolvedValue(users),
                findFirst: jest.fn(),
            },
            message: {
                create: jest.fn().mockResolvedValue({
                    id: 'message-1',
                    chatRoomId: 'room-1',
                    senderId: 'admin-1',
                    content: 'Hello',
                    sender: { id: 'admin-1', firstName: 'Admin', lastName: null, profileImage: null },
                }),
            },
            chatRoom: {
                update: jest.fn().mockResolvedValue({}),
                findFirst: jest.fn(),
            },
            supportNote: {
                findMany: jest.fn(),
                create: jest.fn(),
                findFirst: jest.fn(),
                delete: jest.fn(),
            },
            broadcastCampaign: {
                create: jest.fn().mockResolvedValue({
                    id: 'campaign-1',
                    adminId: 'admin-1',
                    audience: AdminMessageAudience.ALL,
                    text: 'Platform update',
                    mediaUrl: null,
                    mediaKind: null,
                    mediaName: null,
                    mediaMime: null,
                    mediaSize: null,
                    requested: users.length,
                    status: BroadcastCampaignStatus.SENDING,
                    startedAt: new Date(),
                }),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn().mockResolvedValue({
                    id: 'campaign-1',
                    adminId: 'admin-1',
                    audience: AdminMessageAudience.ALL,
                    text: 'Platform update',
                    mediaUrl: null,
                    mediaKind: null,
                    mediaName: null,
                    mediaMime: null,
                    mediaSize: null,
                    requested: users.length,
                    status: BroadcastCampaignStatus.SENDING,
                    startedAt: new Date(),
                    deliveries: users.map((user, index) => ({
                        id: `delivery-${index + 1}`,
                        campaignId: 'campaign-1',
                        userId: user.id,
                        status: BroadcastDeliveryStatus.PENDING,
                        createdAt: new Date(),
                        user,
                    })),
                }),
                count: jest.fn().mockResolvedValue(0),
                aggregate: jest.fn(),
                groupBy: jest.fn(),
            },
            broadcastDelivery: {
                createMany: jest.fn().mockResolvedValue({ count: users.length }),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                count: jest.fn().mockImplementation(({ where }: any) => {
                    if (where.status === BroadcastDeliveryStatus.SENT) return Promise.resolve(users.length);
                    return Promise.resolve(0);
                }),
            },
        } as any;
        const chatService = {
            findOrCreateRoom: jest.fn().mockResolvedValue({ id: 'room-1' }),
        } as any;
        const socketRoom = { emit: jest.fn() };
        const chatGateway = {
            joinRoomForUser: jest.fn(),
            server: { to: jest.fn().mockReturnValue(socketRoom) },
        } as any;
        const notificationsService = {
            create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        } as any;
        const notificationsGateway = { sendNotification: jest.fn() } as any;
        const chatRateLimit = { consumeAdminBroadcast: jest.fn() } as any;

        const service = new AdminMessagingService(
            prisma,
            chatService,
            chatGateway,
            notificationsService,
            notificationsGateway,
            chatRateLimit,
        );

        return { service, prisma, chatService, chatGateway, socketRoom, notificationsService, notificationsGateway };
    };

    it('targets delivery drivers through an APPROVED DELIVERY capability', async () => {
        const { service, prisma } = makeService();

        const result = await service.previewAudience({ audience: AdminMessageAudience.DELIVERY_PROVIDERS });

        expect(result.count).toBe(1);
        expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                contractorProfile: {
                    is: {
                        capabilities: {
                            some: {
                                serviceType: ServiceType.DELIVERY,
                                status: CapabilityStatus.APPROVED,
                            },
                        },
                    },
                },
            }),
        }));
    });

    it('refuses to send if the audience count changed after preview', async () => {
        const { service, chatService } = makeService([recipient, { ...recipient, id: '22222222-2222-4222-8222-222222222222', email: 'second@example.com' }]);

        await expect(service.send('admin-1', {
            audience: AdminMessageAudience.ALL,
            text: 'Important update',
            expectedRecipientCount: 1,
        })).rejects.toBeInstanceOf(BadRequestException);

        expect(chatService.findOrCreateRoom).not.toHaveBeenCalled();
    });

    it('persists broadcast campaign and per-recipient delivery success', async () => {
        const { service, prisma } = makeService();

        const result = await service.send('admin-1', {
            audience: AdminMessageAudience.ALL,
            text: 'Platform update',
            expectedRecipientCount: 1,
        });

        expect(result).toEqual(expect.objectContaining({
            campaignId: 'campaign-1',
            requested: 1,
            sent: 1,
            failed: 0,
        }));
        expect(prisma.broadcastCampaign.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    adminId: 'admin-1',
                    audience: AdminMessageAudience.ALL,
                    requested: 1,
                }),
            }),
        );
        expect(prisma.broadcastDelivery.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        campaignId: 'campaign-1',
                        userId: recipient.id,
                    }),
                ]),
            }),
        );
        expect(prisma.broadcastDelivery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'SENT',
                    roomId: 'room-1',
                    messageId: 'message-1',
                }),
            }),
        );
        expect(prisma.broadcastCampaign.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    sent: 1,
                    failed: 0,
                    status: 'COMPLETED',
                }),
            }),
        );
    });

    it('locks the recipient snapshot when scheduling a broadcast', async () => {
        const { service, prisma, chatService } = makeService();
        const scheduledAt = new Date(Date.now() + 10 * 60 * 1000);

        prisma.broadcastCampaign.create.mockResolvedValue({
            id: 'scheduled-1',
            requested: 1,
            status: BroadcastCampaignStatus.SCHEDULED,
        });

        const result = await service.schedule(
            'admin-1',
            {
                audience: AdminMessageAudience.ALL,
                text: 'Tomorrow update',
                expectedRecipientCount: 1,
            },
            scheduledAt.toISOString(),
        );

        expect(result).toEqual(expect.objectContaining({
            campaignId: 'scheduled-1',
            requested: 1,
            status: BroadcastCampaignStatus.SCHEDULED,
        }));
        expect(prisma.broadcastCampaign.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: BroadcastCampaignStatus.SCHEDULED,
                    scheduledAt,
                    requested: 1,
                }),
            }),
        );
        expect(prisma.broadcastDelivery.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        campaignId: 'scheduled-1',
                        userId: recipient.id,
                        status: BroadcastDeliveryStatus.PENDING,
                    }),
                ]),
            }),
        );
        expect(chatService.findOrCreateRoom).not.toHaveBeenCalled();
    });

    it('rejects a schedule less than one minute in the future', async () => {
        const { service, prisma } = makeService();

        await expect(service.schedule(
            'admin-1',
            {
                audience: AdminMessageAudience.ALL,
                text: 'Too soon',
                expectedRecipientCount: 1,
            },
            new Date(Date.now() + 10_000).toISOString(),
        )).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.broadcastCampaign.create).not.toHaveBeenCalled();
    });

    it('claims a due scheduled campaign once before delivery', async () => {
        const { service, prisma, chatService } = makeService();
        prisma.broadcastCampaign.findMany.mockResolvedValue([{ id: 'campaign-1' }]);
        prisma.broadcastCampaign.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.processDueScheduledBroadcasts(5);

        expect(result).toEqual({ due: 1, claimed: 1 });
        expect(prisma.broadcastCampaign.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'campaign-1',
                    status: BroadcastCampaignStatus.SCHEDULED,
                }),
                data: expect.objectContaining({
                    status: BroadcastCampaignStatus.SENDING,
                }),
            }),
        );
        expect(chatService.findOrCreateRoom).toHaveBeenCalledTimes(1);
    });

    it('does not deliver when another worker already claimed the scheduled campaign', async () => {
        const { service, prisma, chatService } = makeService();
        prisma.broadcastCampaign.findMany.mockResolvedValue([{ id: 'campaign-1' }]);
        prisma.broadcastCampaign.updateMany.mockResolvedValue({ count: 0 });

        const result = await service.processDueScheduledBroadcasts(5);

        expect(result).toEqual({ due: 1, claimed: 0 });
        expect(chatService.findOrCreateRoom).not.toHaveBeenCalled();
    });

    it('cancels only an unstarted scheduled campaign', async () => {
        const { service, prisma } = makeService();
        prisma.broadcastCampaign.updateMany.mockResolvedValue({ count: 1 });
        prisma.broadcastCampaign.findUnique.mockResolvedValue({
            id: 'campaign-1',
            status: BroadcastCampaignStatus.CANCELLED,
            deliveries: [],
            admin: {
                id: 'admin-1',
                firstName: 'Admin',
                lastName: null,
                email: 'admin@example.com',
            },
        });

        const result = await service.cancelScheduledBroadcast('campaign-1');

        expect(result.status).toBe(BroadcastCampaignStatus.CANCELLED);
        expect(prisma.broadcastCampaign.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 'campaign-1',
                    status: BroadcastCampaignStatus.SCHEDULED,
                },
                data: expect.objectContaining({
                    status: BroadcastCampaignStatus.CANCELLED,
                    cancelledAt: expect.any(Date),
                }),
            }),
        );
    });

    it('prevents retrying a campaign that has never been sent', async () => {
        const { service, prisma } = makeService();
        prisma.broadcastCampaign.findUnique.mockResolvedValue({
            id: 'campaign-1',
            status: BroadcastCampaignStatus.SCHEDULED,
        });

        await expect(
            service.retryFailedBroadcast('campaign-1', 'admin-1'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.broadcastDelivery.count).not.toHaveBeenCalled();
    });

    it('returns aggregate delivery analytics', async () => {
        const { service, prisma } = makeService();
        prisma.broadcastCampaign.aggregate.mockResolvedValue({
            _count: { _all: 3 },
            _sum: { requested: 10, sent: 8, failed: 1 },
        });
        prisma.broadcastCampaign.groupBy.mockResolvedValue([
            { status: BroadcastCampaignStatus.COMPLETED, _count: { _all: 1 } },
            { status: BroadcastCampaignStatus.SCHEDULED, _count: { _all: 1 } },
            { status: BroadcastCampaignStatus.PARTIAL, _count: { _all: 1 } },
        ]);

        const result = await service.getBroadcastAnalytics();

        expect(result).toEqual(expect.objectContaining({
            totalCampaigns: 3,
            scheduledCampaigns: 1,
            completedCampaigns: 1,
            partialCampaigns: 1,
            requestedRecipients: 10,
            sentRecipients: 8,
            failedRecipients: 1,
            pendingRecipients: 1,
            deliverySuccessRate: 88.89,
        }));
    });

    it('assigns only an active admin to a support conversation', async () => {
        const { service, prisma, chatGateway } = makeService();
        prisma.chatRoom.findFirst.mockResolvedValue({
            id: 'support-room',
            context: 'SUPPORT',
            deletedAt: null,
        });
        prisma.user.findFirst.mockResolvedValue({ id: 'admin-2' });
        prisma.chatRoom.update.mockResolvedValue({
            id: 'support-room',
            supportAssignedAdminId: 'admin-2',
            supportAssignedAdmin: {
                id: 'admin-2',
                firstName: 'Agent',
                lastName: 'Two',
                email: 'agent2@example.com',
                profileImage: null,
            },
        });

        const result = await service.assignSupportRoom('support-room', 'admin-2');

        expect(prisma.user.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'admin-2',
                    role: UserRole.ADMIN,
                    deletedAt: null,
                }),
            }),
        );
        expect(result.supportAssignedAdminId).toBe('admin-2');
        expect(chatGateway.joinRoomForUser).toHaveBeenCalledWith('admin-2', 'support-room');
    });

    it('stores internal support notes separately from customer messages', async () => {
        const { service, prisma } = makeService();
        prisma.chatRoom.findFirst.mockResolvedValue({
            id: 'support-room',
            context: 'SUPPORT',
            deletedAt: null,
        });
        prisma.supportNote.create.mockResolvedValue({
            id: 'note-1',
            chatRoomId: 'support-room',
            authorId: 'admin-1',
            body: 'Customer called about collection.',
            author: {
                id: 'admin-1',
                firstName: 'Admin',
                lastName: null,
                email: 'admin@example.com',
            },
        });

        const note = await service.addSupportNote(
            'support-room',
            'admin-1',
            ' Customer called about collection. ',
        );

        expect(note.body).toBe('Customer called about collection.');
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.supportNote.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    chatRoomId: 'support-room',
                    authorId: 'admin-1',
                    body: 'Customer called about collection.',
                },
            }),
        );
    });

    it('rejects media URLs that are not from the configured CarMazium storage path', async () => {
        const previousUrl = process.env.SUPABASE_URL;
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        const { service } = makeService();

        try {
            await expect(service.send('admin-1', {
                audience: AdminMessageAudience.ALL,
                mediaUrl: 'https://example.com/video.mp4',
                mediaKind: AdminMediaKind.VIDEO,
                mediaMime: 'video/mp4',
                mediaSize: 1024,
                expectedRecipientCount: 1,
            })).rejects.toBeInstanceOf(BadRequestException);
        } finally {
            if (previousUrl === undefined) delete process.env.SUPABASE_URL;
            else process.env.SUPABASE_URL = previousUrl;
        }
    });
});
