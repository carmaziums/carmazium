import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
    BroadcastCampaignStatus,
    BroadcastDeliveryStatus,
    BroadcastEmailStatus,
    CapabilityStatus,
    ChatContext,
    Prisma,
    ServiceType,
    UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatRateLimitService } from '../chat/chat-rate-limit.service';
import { messageInboxLink } from '../chat/chat-routing';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';
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
        private readonly emailService: EmailService,
    ) {}

    async listChatReports(
        page = 1,
        limit = 30,
        status?: string,
        search?: string,
    ) {
        return this.chatService.listChatReports(page, limit, status, search);
    }

    async updateChatReport(
        reportId: string,
        adminId: string,
        dto: import('../chat/dto').UpdateChatReportDto,
    ) {
        return this.chatService.updateChatReport(reportId, adminId, dto);
    }

    async listDisputes(
        page = 1,
        limit = 30,
        status?: string,
        search?: string,
    ) {
        return this.chatService.listDisputes(page, limit, status, search);
    }

    async joinDispute(disputeId: string, adminId: string) {
        const result = await this.chatService.joinDispute(disputeId, adminId);
        this.chatGateway.joinRoomForUser(adminId, result.room.id);
        if (result.eventMessage) {
            this.chatGateway.broadcastMessage(result.room.id, result.eventMessage);
        }
        return result;
    }

    async resolveDispute(disputeId: string, adminId: string) {
        const result = await this.chatService.resolveDispute(disputeId, adminId);
        if (result.eventMessage) {
            this.chatGateway.broadcastMessage(result.room.id, result.eventMessage);
        }
        return result;
    }

    async previewAudience(dto: AdminAudienceDto) {
        const recipients = await this.resolveRecipients(dto);
        return {
            count: recipients.length,
            sample: recipients.slice(0, 6),
        };
    }

    private async createCampaignSnapshot(
        adminId: string,
        dto: AdminSendMessageDto,
        status: BroadcastCampaignStatus,
        scheduledAt?: Date,
    ) {
        await this.chatRateLimit.consumeAdminBroadcast(adminId);
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
                `Audience changed from ${dto.expectedRecipientCount} to ${recipients.length}. Preview the audience again before continuing.`,
            );
        }

        const campaign = await this.prisma.broadcastCampaign.create({
            data: {
                adminId,
                audience: dto.audience,
                role: dto.role,
                text: text || null,
                mediaUrl: dto.mediaUrl,
                mediaKind: dto.mediaKind,
                mediaName: dto.mediaName,
                mediaMime: dto.mediaMime,
                mediaSize: dto.mediaSize,
                requested: recipients.length,
                status,
                scheduledAt,
                startedAt: status === BroadcastCampaignStatus.SENDING ? new Date() : null,
            },
        });

        await this.prisma.broadcastDelivery.createMany({
            data: recipients.map((recipient) => ({
                id: randomUUID(),
                campaignId: campaign.id,
                userId: recipient.id,
                status: BroadcastDeliveryStatus.PENDING,
            })),
        });

        return { campaign, recipients, text };
    }

    async send(adminId: string, dto: AdminSendMessageDto) {
        const { campaign } = await this.createCampaignSnapshot(
            adminId,
            dto,
            BroadcastCampaignStatus.SENDING,
        );
        return this.deliverCampaign(campaign.id, [BroadcastDeliveryStatus.PENDING], adminId);
    }

    async schedule(adminId: string, dto: AdminSendMessageDto, scheduledAtIso: string) {
        const scheduledAt = new Date(scheduledAtIso);
        if (Number.isNaN(scheduledAt.getTime())) {
            throw new BadRequestException('Scheduled date and time are invalid.');
        }

        const earliest = Date.now() + 60_000;
        const latest = Date.now() + 365 * 24 * 60 * 60 * 1000;
        if (scheduledAt.getTime() < earliest) {
            throw new BadRequestException('Schedule the broadcast at least 1 minute in the future.');
        }
        if (scheduledAt.getTime() > latest) {
            throw new BadRequestException('Scheduled broadcasts can be created up to 1 year ahead.');
        }

        const { campaign } = await this.createCampaignSnapshot(
            adminId,
            dto,
            BroadcastCampaignStatus.SCHEDULED,
            scheduledAt,
        );

        this.logger.log(
            `Admin ${adminId} scheduled campaign ${campaign.id} for ${scheduledAt.toISOString()} with ${campaign.requested} recipients`,
        );

        return {
            campaignId: campaign.id,
            requested: campaign.requested,
            scheduledAt: scheduledAt.toISOString(),
            status: campaign.status,
        };
    }

    private async deliverCampaign(
        campaignId: string,
        targetStatuses: BroadcastDeliveryStatus[],
        senderAdminId?: string,
        targetEmailStatuses?: BroadcastEmailStatus[],
    ) {
        const emailStatuses = targetEmailStatuses ?? (
            targetStatuses.includes(BroadcastDeliveryStatus.FAILED)
                ? [BroadcastEmailStatus.FAILED]
                : [BroadcastEmailStatus.PENDING]
        );

        const channelFilters: Prisma.BroadcastDeliveryWhereInput[] = [];
        if (targetStatuses.length > 0) {
            channelFilters.push({ status: { in: targetStatuses } });
        }
        if (emailStatuses.length > 0) {
            channelFilters.push({ emailStatus: { in: emailStatuses } });
        }

        const campaign = await this.prisma.broadcastCampaign.findUnique({
            where: { id: campaignId },
            include: {
                deliveries: {
                    where: channelFilters.length > 1
                        ? { OR: channelFilters }
                        : channelFilters[0],
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!campaign) {
            throw new NotFoundException('Broadcast campaign not found.');
        }

        const adminId = senderAdminId || campaign.adminId;
        const content = this.buildCampaignContent(campaign);
        const failures: Array<{ userId: string; channel: 'chat' | 'email'; error: string }> = [];

        for (let i = 0; i < campaign.deliveries.length; i += SEND_BATCH_SIZE) {
            const batch = campaign.deliveries.slice(i, i + SEND_BATCH_SIZE);

            const results = await Promise.all(batch.map(async (delivery) => {
                let chat:
                    | { ok: true; roomId: string; messageId: string }
                    | { ok: false; error: string }
                    | null = null;
                let email: {
                    status: BroadcastEmailStatus;
                    messageId: string | null;
                    error?: string;
                } | null = null;

                if (targetStatuses.includes(delivery.status)) {
                    try {
                        const delivered = await this.deliverOne(
                            delivery.id,
                            adminId,
                            delivery.user,
                            content,
                            campaign.text || '',
                            campaign.mediaKind as AdminMediaKind | undefined,
                        );
                        chat = {
                            ok: true,
                            roomId: delivered.room.id,
                            messageId: delivered.message.id,
                        };
                    } catch (error: any) {
                        chat = {
                            ok: false,
                            error: String(error?.message || 'Chat delivery failed').slice(0, 1000),
                        };
                    }
                }

                if (emailStatuses.includes(delivery.emailStatus)) {
                    try {
                        email = await this.deliverEmailOne(delivery.user, {
                            text: campaign.text,
                            mediaUrl: campaign.mediaUrl,
                            mediaKind: campaign.mediaKind,
                        });
                    } catch (error: any) {
                        email = {
                            status: BroadcastEmailStatus.FAILED,
                            messageId: null,
                            error: String(error?.message || 'Email delivery failed').slice(0, 1000),
                        };
                    }
                }

                return { delivery, chat, email };
            }));

            for (const result of results) {
                const data: Prisma.BroadcastDeliveryUpdateInput = {};

                if (result.chat) {
                    if (result.chat.ok) {
                        Object.assign(data, {
                            status: BroadcastDeliveryStatus.SENT,
                            roomId: result.chat.roomId,
                            messageId: result.chat.messageId,
                            error: null,
                        });
                    } else {
                        failures.push({
                            userId: result.delivery.userId,
                            channel: 'chat',
                            error: result.chat.error,
                        });
                        Object.assign(data, {
                            status: BroadcastDeliveryStatus.FAILED,
                            error: result.chat.error,
                        });
                    }
                }

                if (result.email) {
                    if (result.email.status === BroadcastEmailStatus.SENT) {
                        Object.assign(data, {
                            emailStatus: BroadcastEmailStatus.SENT,
                            emailMessageId: result.email.messageId,
                            emailError: null,
                            emailSentAt: new Date(),
                        });
                    } else if (result.email.status === BroadcastEmailStatus.SKIPPED) {
                        Object.assign(data, {
                            emailStatus: BroadcastEmailStatus.SKIPPED,
                            emailMessageId: null,
                            emailError: null,
                        });
                    } else {
                        failures.push({
                            userId: result.delivery.userId,
                            channel: 'email',
                            error: result.email.error || 'Email delivery failed',
                        });
                        Object.assign(data, {
                            emailStatus: BroadcastEmailStatus.FAILED,
                            emailMessageId: null,
                            emailError: result.email.error || 'Email delivery failed',
                        });
                    }
                }

                if (Object.keys(data).length > 0) {
                    await this.prisma.broadcastDelivery.update({
                        where: { id: result.delivery.id },
                        data,
                    });
                }
            }
        }

        const [
            sent,
            failed,
            pending,
            emailSent,
            emailFailed,
            emailSkipped,
            emailPending,
        ] = await Promise.all([
            this.prisma.broadcastDelivery.count({
                where: { campaignId, status: BroadcastDeliveryStatus.SENT },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, status: BroadcastDeliveryStatus.FAILED },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, status: BroadcastDeliveryStatus.PENDING },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, emailStatus: BroadcastEmailStatus.SENT },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, emailStatus: BroadcastEmailStatus.FAILED },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, emailStatus: BroadcastEmailStatus.SKIPPED },
            }),
            this.prisma.broadcastDelivery.count({
                where: { campaignId, emailStatus: BroadcastEmailStatus.PENDING },
            }),
        ]);

        const finalStatus = pending > 0 || emailPending > 0
            ? BroadcastCampaignStatus.SENDING
            : this.broadcastStatus(sent, failed, campaign.requested, emailSent, emailFailed);

        await this.prisma.broadcastCampaign.update({
            where: { id: campaignId },
            data: {
                sent,
                failed,
                emailSent,
                emailFailed,
                emailSkipped,
                status: finalStatus,
                startedAt: campaign.startedAt || new Date(),
                finishedAt: pending === 0 && emailPending === 0 ? new Date() : null,
            },
        });

        this.logger.log(
            `Broadcast campaign ${campaignId}: chat ${sent}/${campaign.requested}, email ${emailSent} sent / ${emailSkipped} skipped / ${emailFailed} failed`,
        );
        if (failures.length > 0) {
            this.logger.warn(
                `Broadcast campaign ${campaignId} had ${failures.length} channel delivery failure(s) in this attempt`,
            );
        }

        return {
            campaignId,
            requested: campaign.requested,
            sent,
            failed,
            pending,
            emailSent,
            emailFailed,
            emailSkipped,
            emailPending,
            status: finalStatus,
            failures: failures.slice(0, 20),
        };
    }

    async recoverStaleSendingBroadcasts(
        limit = 5,
        staleAfterMs = 15 * 60 * 1000,
    ) {
        const cutoff = new Date(Date.now() - staleAfterMs);
        const stale = await this.prisma.broadcastCampaign.findMany({
            where: {
                status: BroadcastCampaignStatus.SENDING,
                startedAt: { lte: cutoff },
                deliveries: {
                    some: {
                        OR: [
                            { status: BroadcastDeliveryStatus.PENDING },
                            { emailStatus: BroadcastEmailStatus.PENDING },
                        ],
                    },
                },
            },
            select: { id: true },
            orderBy: { startedAt: 'asc' },
            take: Math.min(Math.max(limit, 1), 20),
        });

        let recovered = 0;
        for (const campaign of stale) {
            try {
                await this.deliverCampaign(
                    campaign.id,
                    [BroadcastDeliveryStatus.PENDING],
                );
                recovered += 1;
            } catch (error: any) {
                this.logger.error(
                    `Stale broadcast recovery failed for ${campaign.id}: ${error?.message || error}`,
                );
            }
        }

        return { found: stale.length, recovered };
    }

    async processDueScheduledBroadcasts(limit = 5) {
        const now = new Date();
        const due = await this.prisma.broadcastCampaign.findMany({
            where: {
                status: BroadcastCampaignStatus.SCHEDULED,
                scheduledAt: { lte: now },
            },
            select: { id: true },
            orderBy: { scheduledAt: 'asc' },
            take: Math.min(Math.max(limit, 1), 20),
        });

        let claimed = 0;
        for (const candidate of due) {
            const claim = await this.prisma.broadcastCampaign.updateMany({
                where: {
                    id: candidate.id,
                    status: BroadcastCampaignStatus.SCHEDULED,
                    scheduledAt: { lte: now },
                },
                data: {
                    status: BroadcastCampaignStatus.SENDING,
                    startedAt: new Date(),
                },
            });

            if (claim.count !== 1) continue;
            claimed += 1;

            try {
                await this.deliverCampaign(
                    candidate.id,
                    [BroadcastDeliveryStatus.PENDING],
                );
            } catch (error: any) {
                const message = String(error?.message || 'Scheduled broadcast failed').slice(0, 1000);
                this.logger.error(`Scheduled campaign ${candidate.id} failed: ${message}`);

                await Promise.all([
                    this.prisma.broadcastDelivery.updateMany({
                        where: {
                            campaignId: candidate.id,
                            status: BroadcastDeliveryStatus.PENDING,
                        },
                        data: {
                            status: BroadcastDeliveryStatus.FAILED,
                            error: message,
                        },
                    }),
                    this.prisma.broadcastDelivery.updateMany({
                        where: {
                            campaignId: candidate.id,
                            emailStatus: BroadcastEmailStatus.PENDING,
                        },
                        data: {
                            emailStatus: BroadcastEmailStatus.FAILED,
                            emailError: message,
                        },
                    }),
                ]);

                const [failed, emailFailed] = await Promise.all([
                    this.prisma.broadcastDelivery.count({
                        where: {
                            campaignId: candidate.id,
                            status: BroadcastDeliveryStatus.FAILED,
                        },
                    }),
                    this.prisma.broadcastDelivery.count({
                        where: {
                            campaignId: candidate.id,
                            emailStatus: BroadcastEmailStatus.FAILED,
                        },
                    }),
                ]);

                await this.prisma.broadcastCampaign.update({
                    where: { id: candidate.id },
                    data: {
                        failed,
                        emailFailed,
                        status: BroadcastCampaignStatus.FAILED,
                        finishedAt: new Date(),
                    },
                });

            }
        }

        return { due: due.length, claimed };
    }

    async cancelScheduledBroadcast(campaignId: string) {
        const result = await this.prisma.broadcastCampaign.updateMany({
            where: {
                id: campaignId,
                status: BroadcastCampaignStatus.SCHEDULED,
            },
            data: {
                status: BroadcastCampaignStatus.CANCELLED,
                cancelledAt: new Date(),
                finishedAt: new Date(),
            },
        });

        if (result.count !== 1) {
            const campaign = await this.prisma.broadcastCampaign.findUnique({
                where: { id: campaignId },
                select: { status: true },
            });
            if (!campaign) throw new NotFoundException('Broadcast campaign not found.');
            throw new BadRequestException('Only a scheduled broadcast that has not started can be cancelled.');
        }

        return this.getBroadcastCampaign(campaignId);
    }

    async sendScheduledBroadcastNow(campaignId: string) {
        const claim = await this.prisma.broadcastCampaign.updateMany({
            where: {
                id: campaignId,
                status: BroadcastCampaignStatus.SCHEDULED,
            },
            data: {
                status: BroadcastCampaignStatus.SENDING,
                startedAt: new Date(),
            },
        });

        if (claim.count !== 1) {
            const campaign = await this.prisma.broadcastCampaign.findUnique({
                where: { id: campaignId },
                select: { status: true },
            });
            if (!campaign) throw new NotFoundException('Broadcast campaign not found.');
            throw new BadRequestException('Only a scheduled broadcast that has not started can be sent now.');
        }

        await this.deliverCampaign(
            campaignId,
            [BroadcastDeliveryStatus.PENDING],
        );
        return this.getBroadcastCampaign(campaignId);
    }

    private async deliverOne(
        deliveryId: string,
        adminId: string,
        recipient: Recipient,
        content: string,
        plainText: string,
        mediaKind?: AdminMediaKind,
    ) {
        const room = await this.chatService.findOrCreateRoom(adminId, { participantId: recipient.id });
        const messageInclude = {
            sender: {
                select: { id: true, firstName: true, lastName: true, profileImage: true },
            },
        };

        // The delivery UUID is also the message idempotency key. If the process
        // crashes after persisting a message but before BroadcastDelivery is
        // marked SENT, recovery reuses this exact message instead of creating a
        // duplicate or notification.
        const existing = await this.prisma.message.findUnique({
            where: {
                senderId_clientMessageId: {
                    senderId: adminId,
                    clientMessageId: deliveryId,
                },
            },
            include: messageInclude,
        });
        if (existing) {
            return { message: existing, room, duplicate: true };
        }

        let message: any;
        try {
            message = await this.prisma.message.create({
                data: {
                    chatRoomId: room.id,
                    senderId: adminId,
                    clientMessageId: deliveryId,
                    content,
                },
                include: messageInclude,
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const raced = await this.prisma.message.findUnique({
                    where: {
                        senderId_clientMessageId: {
                            senderId: adminId,
                            clientMessageId: deliveryId,
                        },
                    },
                    include: messageInclude,
                });
                if (raced) {
                    return { message: raced, room, duplicate: true };
                }
            }
            throw error;
        }

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

        return { message, room, duplicate: false };
    }

    private async deliverEmailOne(
        recipient: Recipient,
        campaign: { text?: string | null; mediaUrl?: string | null; mediaKind?: string | null },
    ): Promise<{
        status: BroadcastEmailStatus;
        messageId: string | null;
    }> {
        const shouldSend = await this.notificationsService.shouldSendEmail(
            recipient.id,
            'MESSAGE_RECEIVED',
        );
        if (!shouldSend) {
            return {
                status: BroadcastEmailStatus.SKIPPED,
                messageId: null,
            };
        }

        const recipientName = [recipient.firstName, recipient.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();

        const result = await this.emailService.sendAdminBroadcastEmail({
            toEmail: recipient.email,
            recipientName,
            text: campaign.text,
            mediaUrl: campaign.mediaUrl,
            mediaKind: campaign.mediaKind,
        });

        if (!result?.id) {
            throw new Error('Every configured email provider failed.');
        }

        return {
            status: BroadcastEmailStatus.SENT,
            messageId: result.id,
        };
    }

    private broadcastStatus(
        sent: number,
        failed: number,
        requested: number,
        emailSent = 0,
        emailFailed = 0,
    ): BroadcastCampaignStatus {
        if (sent === requested && failed === 0 && emailFailed === 0) {
            return BroadcastCampaignStatus.COMPLETED;
        }
        if (sent === 0 && emailSent === 0) {
            return BroadcastCampaignStatus.FAILED;
        }
        return BroadcastCampaignStatus.PARTIAL;
    }

    private buildCampaignContent(campaign: any): string {
        const text = campaign.text || '';
        if (!campaign.mediaUrl) return text;

        return ADMIN_MEDIA_PREFIX + JSON.stringify({
            text,
            media: {
                url: campaign.mediaUrl,
                kind: campaign.mediaKind,
                name: campaign.mediaName || (campaign.mediaKind === AdminMediaKind.VIDEO ? 'Video' : 'Photo'),
                mime: campaign.mediaMime || null,
                size: campaign.mediaSize || null,
            },
        });
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

    private async requireSupportRoom(roomId: string) {
        const room = await this.prisma.chatRoom.findFirst({
            where: {
                id: roomId,
                context: ChatContext.SUPPORT,
                deletedAt: null,
            },
            include: {
                supportAssignedAdmin: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profileImage: true,
                    },
                },
            },
        });
        if (!room) {
            throw new NotFoundException('Support conversation not found.');
        }
        return room;
    }

    async listSupportAgents() {
        return this.prisma.user.findMany({
            where: { role: UserRole.ADMIN, deletedAt: null },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true,
            },
            orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
        });
    }

    async assignSupportRoom(roomId: string, adminId: string | null) {
        await this.requireSupportRoom(roomId);

        if (adminId) {
            const agent = await this.prisma.user.findFirst({
                where: { id: adminId, role: UserRole.ADMIN, deletedAt: null },
                select: { id: true },
            });
            if (!agent) {
                throw new BadRequestException('Choose an active admin account.');
            }
        }

        const room = await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { supportAssignedAdminId: adminId },
            include: {
                supportAssignedAdmin: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profileImage: true,
                    },
                },
            },
        });

        if (adminId) {
            this.chatGateway.joinRoomForUser(adminId, roomId);
        }

        return {
            supportAssignedAdminId: room.supportAssignedAdminId,
            supportAssignedAdmin: room.supportAssignedAdmin,
        };
    }

    async updateSupportTags(roomId: string, tags: string[]) {
        await this.requireSupportRoom(roomId);

        const cleaned = Array.from(new Set(
            tags
                .map((tag) => tag.trim().toLowerCase())
                .filter(Boolean),
        ));
        if (cleaned.length > 10 || cleaned.some((tag) => tag.length > 32)) {
            throw new BadRequestException('Use up to 10 tags, 32 characters each.');
        }

        const room = await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { supportTags: cleaned },
            select: { supportTags: true },
        });
        return room.supportTags;
    }

    async updateSupportClosed(roomId: string, closed: boolean) {
        await this.requireSupportRoom(roomId);
        const room = await this.prisma.chatRoom.update({
            where: { id: roomId },
            data: { supportClosedAt: closed ? new Date() : null },
            select: { supportClosedAt: true },
        });
        return { supportClosedAt: room.supportClosedAt };
    }

    async listSupportNotes(roomId: string) {
        await this.requireSupportRoom(roomId);
        return this.prisma.supportNote.findMany({
            where: { chatRoomId: roomId },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async addSupportNote(roomId: string, authorId: string, body: string) {
        await this.requireSupportRoom(roomId);
        const cleanBody = body.trim();
        if (!cleanBody) {
            throw new BadRequestException('Enter an internal note.');
        }
        return this.prisma.supportNote.create({
            data: {
                chatRoomId: roomId,
                authorId,
                body: cleanBody,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
    }

    async deleteSupportNote(roomId: string, noteId: string) {
        await this.requireSupportRoom(roomId);
        const note = await this.prisma.supportNote.findFirst({
            where: { id: noteId, chatRoomId: roomId },
            select: { id: true },
        });
        if (!note) {
            throw new NotFoundException('Internal note not found.');
        }
        await this.prisma.supportNote.delete({ where: { id: noteId } });
        return { deleted: true };
    }

    private campaignDateWhere(from?: string, to?: string) {
        const filter: { gte?: Date; lte?: Date } = {};
        if (from) {
            const parsed = new Date(from);
            if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid from date.');
            filter.gte = parsed;
        }
        if (to) {
            const parsed = new Date(to);
            if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid to date.');
            filter.lte = parsed;
        }
        return Object.keys(filter).length ? filter : undefined;
    }

    async listBroadcastCampaigns(
        page = 1,
        limit = 20,
        filters: {
            search?: string;
            status?: string;
            audience?: string;
            from?: string;
            to?: string;
        } = {},
    ) {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const where: Prisma.BroadcastCampaignWhereInput = {};

        if (filters.status) {
            if (!Object.values(BroadcastCampaignStatus).includes(filters.status as BroadcastCampaignStatus)) {
                throw new BadRequestException('Unknown broadcast status.');
            }
            where.status = filters.status as BroadcastCampaignStatus;
        }
        if (filters.audience) {
            where.audience = filters.audience;
        }
        const createdAt = this.campaignDateWhere(filters.from, filters.to);
        if (createdAt) where.createdAt = createdAt;

        const search = filters.search?.trim();
        if (search) {
            where.OR = [
                { text: { contains: search, mode: 'insensitive' } },
                { mediaName: { contains: search, mode: 'insensitive' } },
                { audience: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.broadcastCampaign.findMany({
                where,
                include: {
                    admin: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
                skip: (safePage - 1) * safeLimit,
                take: safeLimit,
            }),
            this.prisma.broadcastCampaign.count({ where }),
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

    async getBroadcastAnalytics(from?: string, to?: string) {
        const where: Prisma.BroadcastCampaignWhereInput = {};
        const createdAt = this.campaignDateWhere(from, to);
        if (createdAt) where.createdAt = createdAt;

        const [campaigns, statusGroups] = await Promise.all([
            this.prisma.broadcastCampaign.aggregate({
                where,
                _count: { _all: true },
                _sum: {
                    requested: true,
                    sent: true,
                    failed: true,
                    emailSent: true,
                    emailFailed: true,
                    emailSkipped: true,
                },
            }),
            this.prisma.broadcastCampaign.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            }),
        ]);

        const byStatus = Object.fromEntries(
            statusGroups.map((group) => [group.status, group._count._all]),
        ) as Record<string, number>;
        const requested = campaigns._sum.requested || 0;
        const sent = campaigns._sum.sent || 0;
        const failed = campaigns._sum.failed || 0;
        const attempted = sent + failed;
        const emailSent = campaigns._sum.emailSent || 0;
        const emailFailed = campaigns._sum.emailFailed || 0;
        const emailSkipped = campaigns._sum.emailSkipped || 0;
        const emailAttempted = emailSent + emailFailed + emailSkipped;

        return {
            totalCampaigns: campaigns._count._all,
            scheduledCampaigns: byStatus[BroadcastCampaignStatus.SCHEDULED] || 0,
            completedCampaigns: byStatus[BroadcastCampaignStatus.COMPLETED] || 0,
            partialCampaigns: byStatus[BroadcastCampaignStatus.PARTIAL] || 0,
            failedCampaigns: byStatus[BroadcastCampaignStatus.FAILED] || 0,
            cancelledCampaigns: byStatus[BroadcastCampaignStatus.CANCELLED] || 0,
            sendingCampaigns: byStatus[BroadcastCampaignStatus.SENDING] || 0,
            requestedRecipients: requested,
            sentRecipients: sent,
            failedRecipients: failed,
            pendingRecipients: Math.max(requested - sent - failed, 0),
            attemptedRecipients: attempted,
            deliverySuccessRate: attempted > 0
                ? Math.round((sent / attempted) * 10000) / 100
                : null,
            emailSentRecipients: emailSent,
            emailFailedRecipients: emailFailed,
            emailSkippedRecipients: emailSkipped,
            emailPendingRecipients: Math.max(requested - emailAttempted, 0),
            emailAttemptedRecipients: emailAttempted,
            emailSuccessRate: emailSent + emailFailed > 0
                ? Math.round((emailSent / (emailSent + emailFailed)) * 10000) / 100
                : null,
        };
    }

    async getBroadcastCampaign(campaignId: string) {
        const campaign = await this.prisma.broadcastCampaign.findUnique({
            where: { id: campaignId },
            include: {
                admin: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                deliveries: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!campaign) {
            throw new NotFoundException('Broadcast campaign not found.');
        }
        return campaign;
    }

    async retryFailedBroadcast(campaignId: string, adminId: string) {
        await this.chatRateLimit.consumeAdminBroadcast(adminId);
        const campaign = await this.prisma.broadcastCampaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                status: true,
            },
        });
        if (!campaign) {
            throw new NotFoundException('Broadcast campaign not found.');
        }
        if (
            campaign.status === BroadcastCampaignStatus.SCHEDULED ||
            campaign.status === BroadcastCampaignStatus.CANCELLED
        ) {
            throw new BadRequestException('This campaign has not completed a delivery attempt.');
        }

        const failedCount = await this.prisma.broadcastDelivery.count({
            where: {
                campaignId,
                OR: [
                    { status: BroadcastDeliveryStatus.FAILED },
                    { emailStatus: BroadcastEmailStatus.FAILED },
                ],
            },
        });
        if (failedCount === 0) {
            return this.getBroadcastCampaign(campaignId);
        }

        await this.prisma.broadcastCampaign.update({
            where: { id: campaignId },
            data: {
                status: BroadcastCampaignStatus.SENDING,
                startedAt: new Date(),
                finishedAt: null,
            },
        });

        await this.deliverCampaign(
            campaignId,
            [BroadcastDeliveryStatus.FAILED],
            adminId,
        );
        return this.getBroadcastCampaign(campaignId);
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
