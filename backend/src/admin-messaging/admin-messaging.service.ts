import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatRateLimitService } from '../chat/chat-rate-limit.service';
import { messageInboxLink } from '../chat/chat-routing';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
    AdminAudienceDto,
    AdminMediaKind,
    AdminMessageAudience,
    AdminSendMessageDto,
} from './dto/admin-message.dto';

const ADMIN_MEDIA_PREFIX = '__CARMAZIUM_ADMIN_MEDIA_V1__:';
const MAX_RECIPIENTS = 10000;
const SEND_BATCH_SIZE = 20;

type Recipient = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
};

@Injectable()
export class AdminMessagingService {
    private readonly logger = new Logger(AdminMessagingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly chatRateLimit: ChatRateLimitService,
    ) {}

    async previewAudience(dto: AdminAudienceDto) {
        const recipients = await this.resolveRecipients(dto);
        return {
            count: recipients.length,
            sample: recipients.slice(0, 6),
        };
    }

    async send(adminId: string, dto: AdminSendMessageDto) {
        this.chatRateLimit.consumeAdminBroadcast(adminId);
        const text = dto.text?.trim() || '';
        if (!text && !dto.mediaUrl) {
            throw new BadRequestException('Enter a message or attach a picture/video.');
        }
        this.validateMedia(dto);

        const recipients = await this.resolveRecipients(dto);
        if (recipients.length === 0) {
            throw new BadRequestException('This audience currently has no recipients.');
        }
        if (recipients.length !== dto.expectedRecipientCount) {
            throw new BadRequestException(
                `Audience changed from ${dto.expectedRecipientCount} to ${recipients.length}. Preview the audience again before sending.`,
            );
        }

        const content = this.buildStoredContent(dto, text);
        const failures: Array<{ userId: string; error: string }> = [];
        let sent = 0;

        for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
            const batch = recipients.slice(i, i + SEND_BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map((recipient) => this.deliverOne(adminId, recipient, content, text, dto.mediaKind)),
            );

            results.forEach((result, index) => {
                const recipient = batch[index];
                if (result.status === 'fulfilled') {
                    sent += 1;
                } else {
                    failures.push({
                        userId: recipient.id,
                        error: result.reason?.message || 'Delivery failed',
                    });
                }
            });
        }

        this.logger.log(
            `Admin ${adminId} sent audience message ${dto.audience} to ${sent}/${recipients.length} recipients`,
        );
        if (failures.length > 0) {
            this.logger.warn(`Admin broadcast had ${failures.length} delivery failure(s)`);
        }

        return {
            requested: recipients.length,
            sent,
            failed: failures.length,
            failures: failures.slice(0, 20),
        };
    }

    private async deliverOne(
        adminId: string,
        recipient: Recipient,
        content: string,
        plainText: string,
        mediaKind?: AdminMediaKind,
    ) {
        const room = await this.chatService.findOrCreateRoom(adminId, { participantId: recipient.id });

        const message = await this.prisma.message.create({
            data: {
                chatRoomId: room.id,
                senderId: adminId,
                content,
            },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true, profileImage: true },
                },
            },
        });

        await this.prisma.chatRoom.update({
            where: { id: room.id },
            data: { updatedAt: new Date() },
        });

        // Existing sockets only auto-join rooms that existed at connection time.
        this.chatGateway.joinRoomForUser(adminId, room.id);
        this.chatGateway.joinRoomForUser(recipient.id, room.id);
        this.chatGateway.server?.to(`room:${room.id}`).emit('message:new', message);

        const preview = plainText
            ? plainText.slice(0, 80) + (plainText.length > 80 ? '…' : '')
            : mediaKind === AdminMediaKind.VIDEO
                ? 'CarMazium sent you a video.'
                : 'CarMazium sent you a photo.';

        try {
            const notification = await this.notificationsService.create({
                userId: recipient.id,
                type: 'MESSAGE_RECEIVED',
                title: 'Message from CarMazium',
                message: preview,
                link: messageInboxLink(recipient.role, room.id),
                data: { roomId: room.id, messageId: message.id, adminBroadcast: true },
            });
            this.notificationsGateway.sendNotification(recipient.id, notification);
        } catch (error: any) {
            // The chat message itself is authoritative; a notification failure
            // must never roll it back.
            this.logger.warn(`Notification failed for ${recipient.id}: ${error?.message}`);
        }

        return message;
    }

    private buildStoredContent(dto: AdminSendMessageDto, text: string): string {
        if (!dto.mediaUrl) return text;

        return ADMIN_MEDIA_PREFIX + JSON.stringify({
            text,
            media: {
                url: dto.mediaUrl,
                kind: dto.mediaKind,
                name: dto.mediaName || (dto.mediaKind === AdminMediaKind.VIDEO ? 'Video' : 'Photo'),
                mime: dto.mediaMime || null,
                size: dto.mediaSize || null,
            },
        });
    }

    private validateMedia(dto: AdminSendMessageDto) {
        if (!dto.mediaUrl) {
            if (dto.mediaKind || dto.mediaName || dto.mediaMime || dto.mediaSize) {
                throw new BadRequestException('Media metadata was provided without a media URL.');
            }
            return;
        }
        if (!dto.mediaKind) {
            throw new BadRequestException('Choose whether the attachment is a picture or video.');
        }

        let parsed: URL;
        try {
            parsed = new URL(dto.mediaUrl);
        } catch {
            throw new BadRequestException('Attachment URL is invalid.');
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new BadRequestException('Media storage is not configured on the server.');
        }
        const allowedHost = new URL(supabaseUrl).host;
        const allowedPath = '/storage/v1/object/public/listings/admin-messages/';
        if (parsed.protocol !== 'https:' || parsed.host !== allowedHost || !parsed.pathname.includes(allowedPath)) {
            throw new BadRequestException('Attachment must be uploaded through the CarMazium admin media uploader.');
        }

        if (dto.mediaMime) {
            const expectedPrefix = dto.mediaKind === AdminMediaKind.IMAGE ? 'image/' : 'video/';
            if (!dto.mediaMime.toLowerCase().startsWith(expectedPrefix)) {
                throw new BadRequestException('Attachment type does not match the selected media type.');
            }
        }

        if (dto.mediaSize) {
            const limit = dto.mediaKind === AdminMediaKind.IMAGE
                ? 10 * 1024 * 1024
                : 25 * 1024 * 1024;
            if (dto.mediaSize > limit) {
                throw new BadRequestException(
                    dto.mediaKind === AdminMediaKind.IMAGE
                        ? 'Pictures must be 10 MB or smaller.'
                        : 'Videos must be 25 MB or smaller.',
                );
            }
        }
    }

    private async resolveRecipients(dto: AdminAudienceDto): Promise<Recipient[]> {
        const base: Prisma.UserWhereInput = {
            deletedAt: null,
            role: { not: UserRole.ADMIN },
        };

        let where: Prisma.UserWhereInput;
        switch (dto.audience) {
            case AdminMessageAudience.ALL:
                where = base;
                break;

            case AdminMessageAudience.ROLE:
                if (!dto.role || dto.role === UserRole.ADMIN) {
                    throw new BadRequestException('Choose a non-admin account role.');
                }
                where = { ...base, role: dto.role };
                break;

            case AdminMessageAudience.DEALERS:
                where = { ...base, role: UserRole.DEALER };
                break;

            case AdminMessageAudience.SERVICE_PROVIDERS:
                where = { ...base, role: UserRole.CONTRACTOR };
                break;

            case AdminMessageAudience.DELIVERY_PROVIDERS:
                where = this.capabilityWhere(ServiceType.DELIVERY);
                break;

            case AdminMessageAudience.INSPECTION_PROVIDERS:
                where = this.capabilityWhere(ServiceType.INSPECTION);
                break;

            case AdminMessageAudience.WARRANTY_PROVIDERS:
                where = this.capabilityWhere(ServiceType.WARRANTY);
                break;

            case AdminMessageAudience.FINANCE_PROVIDERS:
                where = {
                    ...base,
                    OR: [
                        { role: UserRole.FINANCE_PARTNER },
                        this.capabilityWhere(ServiceType.FINANCE),
                    ],
                };
                break;

            case AdminMessageAudience.INSURANCE_PROVIDERS:
                where = { ...base, role: UserRole.INSURANCE_PARTNER };
                break;

            default:
                throw new BadRequestException('Unknown audience.');
        }

        const recipients = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
            orderBy: { createdAt: 'asc' },
            take: MAX_RECIPIENTS + 1,
        });

        if (recipients.length > MAX_RECIPIENTS) {
            throw new BadRequestException(`Audience is too large. Maximum ${MAX_RECIPIENTS} recipients per broadcast.`);
        }

        // OR filters can theoretically match the same account in two branches.
        return Array.from(new Map(recipients.map((user) => [user.id, user])).values());
    }

    private capabilityWhere(serviceType: ServiceType): Prisma.UserWhereInput {
        return {
            deletedAt: null,
            role: { not: UserRole.ADMIN },
            contractorProfile: {
                is: {
                    capabilities: {
                        some: {
                            serviceType,
                            status: CapabilityStatus.APPROVED,
                        },
                    },
                },
            },
        };
    }
}
