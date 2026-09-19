import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TradeTeamPermissionInput, UpdateTradeTeamPermissionsDto } from './trade-team.dto';

export type TradeTeamAction = 'view' | 'chat' | 'quote' | 'manage' | 'complete';

export interface TradeActorContext {
    actingUserId: string;
    contractorProfileId: string;
    businessOwnerUserId: string;
    dealerProfileId: string | null;
    businessName: string | null;
    isStaff: boolean;
    allowedServiceTypes: ServiceType[];
    canView: boolean;
    canChat: boolean;
    canQuote: boolean;
    canManage: boolean;
    canComplete: boolean;
}

type PermissionRow = {
    id: string;
    dealerProfileId: string;
    staffUserId: string | null;
    email: string;
    deliveryEnabled: boolean;
    inspectionEnabled: boolean;
    canView: boolean;
    canChat: boolean;
    canQuote: boolean;
    canManage: boolean;
    canComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
};

@Injectable()
export class TradeTeamService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    private normaliseEmail(value: string) {
        return String(value || '').trim().toLowerCase();
    }

    private strictPermissionInput(input: UpdateTradeTeamPermissionsDto): TradeTeamPermissionInput {
        const booleanFields = [
            'deliveryEnabled',
            'inspectionEnabled',
            'canView',
            'canChat',
            'canQuote',
            'canManage',
            'canComplete',
        ] as const;
        for (const field of booleanFields) {
            if (typeof input[field] !== 'boolean') {
                throw new BadRequestException(`${field} must be a real boolean value.`);
            }
        }
        return {
            email: this.normaliseEmail(input.email),
            deliveryEnabled: input.deliveryEnabled as boolean,
            inspectionEnabled: input.inspectionEnabled as boolean,
            canView: input.canView as boolean,
            canChat: input.canChat as boolean,
            canQuote: input.canQuote as boolean,
            canManage: input.canManage as boolean,
            canComplete: input.canComplete as boolean,
        };
    }

    private async syncBusinessIdentity(dealer: any) {
        const provider = dealer.user?.contractorProfile;
        if (!provider) return provider;

        const data = {
            businessName: dealer.companyName?.trim() || null,
            phone: dealer.phone?.trim() || null,
            serviceArea: dealer.businessAddress?.trim() || null,
        };
        if (
            provider.businessName !== data.businessName ||
            provider.phone !== data.phone ||
            provider.serviceArea !== data.serviceArea
        ) {
            return this.prisma.contractorProfile.update({
                where: { id: provider.id },
                data,
                include: { capabilities: { orderBy: { appliedAt: 'desc' } } },
            });
        }
        return provider;
    }

    private async permissionFor(dealerProfileId: string, userId: string, email: string): Promise<PermissionRow | null> {
        const rows = await this.prisma.$queryRaw<PermissionRow[]>(Prisma.sql`
            SELECT * FROM "trade_service_team_permissions"
            WHERE "dealerProfileId" = ${dealerProfileId}
              AND (
                  "staffUserId" = ${userId}
                  OR ("staffUserId" IS NULL AND "email" = ${email})
              )
            ORDER BY CASE WHEN "staffUserId" = ${userId} THEN 0 ELSE 1 END
            LIMIT 1
        `);
        const permission = rows[0] ?? null;
        if (permission && !permission.staffUserId) {
            const bound = await this.prisma.$queryRaw<PermissionRow[]>(Prisma.sql`
                UPDATE "trade_service_team_permissions"
                SET "staffUserId" = ${userId}, "email" = ${email}, "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${permission.id} AND "staffUserId" IS NULL
                RETURNING *
            `);
            return bound[0] ?? permission;
        }
        return permission;
    }

    /**
     * Resolve the provider identity an authenticated user is allowed to act as.
     *
     * An active dealership-team permission deliberately wins over an independent
     * contractor profile owned by the same person. This prevents a driver or
     * inspector who also trades independently from accidentally quoting under
     * their personal payout account while they are working for the dealership.
     */
    async tryResolveActor(userId: string): Promise<TradeActorContext | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user?.email) return null;
        const email = this.normaliseEmail(user.email);

        const memberships = await this.prisma.dealerStaff.findMany({
            where: { userId, isActive: true },
            include: {
                dealerProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                contractorProfile: {
                                    include: {
                                        capabilities: {
                                            where: { status: CapabilityStatus.APPROVED },
                                            select: { serviceType: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const staffContexts: TradeActorContext[] = [];
        for (const membership of memberships) {
            const dealer = membership.dealerProfile;
            const provider = dealer.user.contractorProfile;
            if (!provider) continue;

            const permission = await this.permissionFor(dealer.id, userId, email);
            if (!permission) continue;

            const approved = new Set(provider.capabilities.map((c) => c.serviceType));
            const allowed: ServiceType[] = [];
            if (permission.deliveryEnabled && approved.has(ServiceType.DELIVERY)) allowed.push(ServiceType.DELIVERY);
            if (permission.inspectionEnabled && approved.has(ServiceType.INSPECTION)) allowed.push(ServiceType.INSPECTION);
            if (!allowed.length) continue;

            staffContexts.push({
                actingUserId: userId,
                contractorProfileId: provider.id,
                businessOwnerUserId: dealer.user.id,
                dealerProfileId: dealer.id,
                businessName: dealer.companyName,
                isStaff: true,
                allowedServiceTypes: allowed,
                canView: permission.canView,
                canChat: permission.canChat,
                canQuote: permission.canQuote,
                canManage: permission.canManage,
                canComplete: permission.canComplete,
            });
        }

        if (staffContexts.length > 1) {
            throw new ForbiddenException(
                'You have TradeXchange access for more than one business. Ask the business owner to remove the duplicate membership before acting on jobs.',
            );
        }
        if (staffContexts.length === 1) return staffContexts[0];

        // No active dealership TradeXchange assignment: fall back to the user's
        // own independently approved provider profile, preserving the existing
        // contractor marketplace behaviour.
        const direct = await this.prisma.contractorProfile.findUnique({
            where: { userId },
            include: {
                capabilities: {
                    where: { status: CapabilityStatus.APPROVED },
                    select: { serviceType: true },
                },
                user: { select: { id: true } },
            },
        });
        if (!direct?.capabilities.length) return null;

        return {
            actingUserId: userId,
            contractorProfileId: direct.id,
            businessOwnerUserId: direct.userId,
            dealerProfileId: null,
            businessName: direct.businessName ?? null,
            isStaff: false,
            allowedServiceTypes: direct.capabilities.map((c) => c.serviceType),
            canView: true,
            canChat: true,
            canQuote: true,
            canManage: true,
            canComplete: true,
        };
    }

    async requireActor(userId: string) {
        const actor = await this.tryResolveActor(userId);
        if (!actor) {
            throw new ForbiddenException(
                'This area is for approved service providers or authorised dealership team members.',
            );
        }
        return actor;
    }

    async assertJobPermission(actor: TradeActorContext, jobId: string, action: TradeTeamAction) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            select: { serviceType: true, customerId: true },
        });
        if (!job) throw new NotFoundException('Service job not found.');
        if (!actor.allowedServiceTypes.includes(job.serviceType)) {
            throw new ForbiddenException('Your business role does not allow access to this service job.');
        }
        if (action === 'quote' && (job.customerId === actor.actingUserId || job.customerId === actor.businessOwnerUserId)) {
            throw new BadRequestException('You cannot quote on a job posted by you or your business.');
        }
        if (actor.isStaff) {
            const allowed =
                action === 'view' ? actor.canView :
                action === 'chat' ? actor.canChat :
                action === 'quote' ? actor.canQuote :
                action === 'manage' ? actor.canManage :
                actor.canComplete;
            if (!allowed) throw new ForbiddenException(`Your business role does not allow you to ${action} this job.`);
        }
        return job;
    }

    async contractorProfileForJob(userId: string, jobId: string): Promise<string | null> {
        const actor = await this.tryResolveActor(userId);
        if (!actor) return null;
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            select: { serviceType: true },
        });
        if (!job || !actor.allowedServiceTypes.includes(job.serviceType)) return null;
        if (actor.isStaff && !actor.canView) return null;
        return actor.contractorProfileId;
    }

    async logAction(actor: TradeActorContext, jobId: string, action: string, metadata?: Record<string, unknown>) {
        if (!actor.isStaff) return;
        const auditMetadata = {
            ...(metadata ?? {}),
            permissionSnapshot: {
                serviceTypes: actor.allowedServiceTypes,
                canView: actor.canView,
                canChat: actor.canChat,
                canQuote: actor.canQuote,
                canManage: actor.canManage,
                canComplete: actor.canComplete,
            },
        };
        await this.prisma.$executeRaw(Prisma.sql`
            INSERT INTO "trade_service_team_action_log" (
                "id", "jobId", "dealerProfileId", "contractorProfileId", "actingUserId", "action", "metadata", "createdAt"
            ) VALUES (
                gen_random_uuid()::text, ${jobId}, ${actor.dealerProfileId}, ${actor.contractorProfileId},
                ${actor.actingUserId}, ${action}, ${JSON.stringify(auditMetadata)}::jsonb, CURRENT_TIMESTAMP
            )
        `);
    }

    async notifyOperationalStaff(
        contractorProfileId: string,
        serviceType: ServiceType,
        type: string,
        title: string,
        message: string,
        link: string,
    ) {
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
            SELECT DISTINCT p."staffUserId" AS "userId"
            FROM "trade_service_team_permissions" p
            JOIN "dealer_staff" ds
              ON ds."dealerProfileId" = p."dealerProfileId"
             AND ds."userId" = p."staffUserId"
             AND ds."isActive" = true
            JOIN "dealer_profiles" d ON d."id" = p."dealerProfileId"
            JOIN "contractor_profiles" cp ON cp."userId" = d."userId"
            WHERE cp."id" = ${contractorProfileId}
              AND p."staffUserId" IS NOT NULL
              AND p."canView" = true
              AND (
                  (${serviceType}::service_type = 'DELIVERY'::service_type AND p."deliveryEnabled" = true)
                  OR
                  (${serviceType}::service_type = 'INSPECTION'::service_type AND p."inspectionEnabled" = true)
              )
        `);
        await Promise.allSettled(rows.map((row) => this.notifications.create({
            userId: row.userId,
            type,
            title,
            message,
            link,
            entityType: 'SERVICE_JOB',
        } as any)));
    }

    private async ownerDealer(userId: string) {
        const dealer = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        stripeConnectAccountId: true,
                        stripeConnectOnboardingComplete: true,
                        contractorProfile: {
                            include: { capabilities: { orderBy: { appliedAt: 'desc' } } },
                        },
                    },
                },
                staff: {
                    where: { isActive: true },
                    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                },
                invites: true,
            },
        });
        if (!dealer) throw new ForbiddenException('Only the dealership owner can manage TradeXchange team permissions.');
        return dealer;
    }

    async listTeam(ownerUserId: string) {
        const dealer = await this.ownerDealer(ownerUserId);
        const permissions = await this.prisma.$queryRaw<PermissionRow[]>(Prisma.sql`
            SELECT * FROM "trade_service_team_permissions"
            WHERE "dealerProfileId" = ${dealer.id}
            ORDER BY "email" ASC
        `);
        return {
            dealerProfileId: dealer.id,
            companyName: dealer.companyName,
            stripeConnect: {
                connected: !!dealer.user.stripeConnectAccountId,
                complete: !!dealer.user.stripeConnectOnboardingComplete,
            },
            capabilities: dealer.user.contractorProfile?.capabilities ?? [],
            permissions,
            payoutPolicy: 'Customers pay CarMazium. CarMazium deducts 9%; the remaining 91% is paid only to the business Stripe Connect account.',
        };
    }

    async setPermissions(ownerUserId: string, input: TradeTeamPermissionInput) {
        const dealer = await this.ownerDealer(ownerUserId);
        const email = this.normaliseEmail(input.email);
        if (!email || !email.includes('@')) throw new BadRequestException('A valid team member email is required.');
        if ((input.canQuote || input.canManage || input.canComplete) && !input.deliveryEnabled && !input.inspectionEnabled) {
            throw new BadRequestException('Select Delivery/Recovery or Vehicle Inspection before granting job permissions.');
        }

        const active = dealer.staff.some((s) => this.normaliseEmail(s.user.email) === email);
        const pending = dealer.invites.some((i) => this.normaliseEmail(i.email) === email && i.expiresAt > new Date());
        if (!active && !pending) {
            throw new ForbiddenException('TradeXchange permissions can only be granted to active staff or a pending dealership invitation.');
        }

        const rows = await this.prisma.$queryRaw<PermissionRow[]>(Prisma.sql`
            INSERT INTO "trade_service_team_permissions" (
                "id", "dealerProfileId", "email", "deliveryEnabled", "inspectionEnabled",
                "canQuote", "canManage", "canComplete", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, ${dealer.id}, ${email}, ${!!input.deliveryEnabled}, ${!!input.inspectionEnabled},
                ${!!input.canQuote}, ${!!input.canManage}, ${!!input.canComplete}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("dealerProfileId", "email") DO UPDATE SET
                "deliveryEnabled" = EXCLUDED."deliveryEnabled",
                "inspectionEnabled" = EXCLUDED."inspectionEnabled",
                "canQuote" = EXCLUDED."canQuote",
                "canManage" = EXCLUDED."canManage",
                "canComplete" = EXCLUDED."canComplete",
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `);
        return rows[0];
    }

    async applyBusinessCapability(ownerUserId: string, serviceType: ServiceType) {
        const supported: readonly ServiceType[] = [
            ServiceType.DELIVERY,
            ServiceType.INSPECTION,
            ServiceType.FINANCE,
            ServiceType.WARRANTY,
        ];
        if (!supported.includes(serviceType)) {
            throw new BadRequestException('This service cannot be added to a Partner Account.');
        }
        const dealer = await this.ownerDealer(ownerUserId);
        const profile = await this.prisma.contractorProfile.upsert({
            where: { userId: ownerUserId },
            create: {
                userId: ownerUserId,
                businessName: dealer.companyName,
                phone: dealer.phone,
                serviceArea: dealer.businessAddress,
            },
            update: {
                businessName: dealer.companyName,
                ...(dealer.phone ? { phone: dealer.phone } : {}),
                ...(dealer.businessAddress ? { serviceArea: dealer.businessAddress } : {}),
            },
        });
        const existing = await this.prisma.contractorCapability.findUnique({
            where: { contractorId_serviceType: { contractorId: profile.id, serviceType } },
        });
        if (existing?.status === CapabilityStatus.APPROVED || existing?.status === CapabilityStatus.PENDING) return existing;
        if (existing?.status === CapabilityStatus.SUSPENDED) {
            throw new ConflictException('This business service capability is suspended. Contact CarMazium support or an administrator.');
        }
        return this.prisma.contractorCapability.upsert({
            where: { contractorId_serviceType: { contractorId: profile.id, serviceType } },
            create: { contractorId: profile.id, serviceType },
            update: {
                status: CapabilityStatus.PENDING,
                appliedAt: new Date(),
                reviewedAt: null,
                reviewedById: null,
                reviewNote: null,
            },
        });
    }
}
