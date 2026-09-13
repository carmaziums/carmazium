import { BadRequestException } from '@nestjs/common';
import { CapabilityStatus, ServiceType, UserRole } from '@prisma/client';
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
            user: { findMany: jest.fn().mockResolvedValue(users) },
            message: {
                create: jest.fn().mockResolvedValue({
                    id: 'message-1',
                    chatRoomId: 'room-1',
                    senderId: 'admin-1',
                    content: 'Hello',
                    sender: { id: 'admin-1', firstName: 'Admin', lastName: null, profileImage: null },
                }),
            },
            chatRoom: { update: jest.fn().mockResolvedValue({}) },
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

        const service = new AdminMessagingService(
            prisma,
            chatService,
            chatGateway,
            notificationsService,
            notificationsGateway,
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

    it('delivers an individual message through the existing support conversation and live socket', async () => {
        const { service, prisma, chatService, chatGateway, socketRoom, notificationsService } = makeService();

        const result = await service.send('admin-1', {
            audience: AdminMessageAudience.PERSON,
            userId: recipient.id,
            text: 'Hello from CarMazium',
            expectedRecipientCount: 1,
        });

        expect(result).toEqual(expect.objectContaining({ requested: 1, sent: 1, failed: 0 }));
        expect(chatService.findOrCreateRoom).toHaveBeenCalledWith('admin-1', { participantId: recipient.id });
        expect(prisma.message.create).toHaveBeenCalled();
        expect(chatGateway.joinRoomForUser).toHaveBeenCalledWith(recipient.id, 'room-1');
        expect(socketRoom.emit).toHaveBeenCalledWith('message:new', expect.any(Object));
        expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: recipient.id,
            type: 'MESSAGE_RECEIVED',
            title: 'Message from CarMazium',
        }));
    });

    it('rejects media URLs that are not from the configured CarMazium storage path', async () => {
        const previousUrl = process.env.SUPABASE_URL;
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        const { service } = makeService();

        try {
            await expect(service.send('admin-1', {
                audience: AdminMessageAudience.PERSON,
                userId: recipient.id,
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
