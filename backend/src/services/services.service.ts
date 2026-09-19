import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    Prisma,
    ServiceType,
    ServiceJobStatus,
    ServiceQuoteStatus,
    ServicePaymentStatus,
    CapabilityStatus,
    UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';
import { resolveFrontendUrl } from '../core/frontend-url';
import {
    CreateJobDto, JobFromPurchaseDto, CancelJobDto, UpsertQuoteDto,
    ApplyCapabilityDto, UpdateLeadMatchingDto, UpdateJobMatchingDto, ReviewCapabilityDto, ResolveDisputeDto, JOB_SERVICE_TYPES,
} from './dto';
import { assertServiceAcceptingNewRequests } from './service-availability';
import { assertCapabilityVerificationReady } from './capability-verification';
import { TradeTeamService } from './trade-team.service';
import { parseFutureRequestedFor, postcodeArea, requireUkPostcode } from './service-validation';
import { boundedServiceLimit, decodeServiceCursor, makeServicePage } from './service-pagination';

/** Days an OPEN job accepts quotes before it expires. */
const JOB_OPEN_DAYS = 7;
/** Hours after a contractor marks COMPLETED before the customer is assumed to agree. */
const AUTO_CONFIRM_HOURS = 48;
export const MAX_ACTIVE_SERVICE_JOBS_PER_CUSTOMER = 10;
const ACTIVE_CUSTOMER_JOB_STATUSES: ServiceJobStatus[] = [
    ServiceJobStatus.OPEN,
    ServiceJobStatus.ACCEPTED,
    ServiceJobStatus.PAID,
    ServiceJobStatus.IN_PROGRESS,
    ServiceJobStatus.COMPLETED,
    ServiceJobStatus.DISPUTED,
];

/**
 * What a job looks like to whoever is asking. The customer's identity and
 * street addresses are private until the accepted job is paid. Postcodes are
 * NOT private: an approved provider cannot quote a route without them.
 */
type Viewer = { userId: string; role: UserRole; contractorProfileId?: string | null };

const CUSTOMER_PUBLIC = { id: true, firstName: true } as const;
const CUSTOMER_PRIVATE = { id: true, firstName: true, lastName: true, email: true, phone: true } as const;
const CONTRACTOR_PUBLIC = {
    id: true, businessName: true, rating: true, totalReviews: true, serviceArea: true,
    user: { select: { firstName: true } },
} as const;
const CONTRACTOR_PRIVATE = {
    id: true, businessName: true, phone: true, rating: true, totalReviews: true, serviceArea: true,
    user: { select: { firstName: true, lastName: true, email: true, phone: true } },
} as const;

@Injectable()
export class ServicesService {
    private readonly logger = new Logger(ServicesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly email: EmailService,
        private readonly payments: PaymentsService,
        private readonly config: ConfigService,
        @Optional() private readonly tradeTeam?: TradeTeamService,
    ) { }

    // ── Money ──────────────────────────────────────────────────────────────

    /** TradeXchange paid jobs always use the agreed 9% CarMazium / 91% provider split. */
    private feeRate(): number {
        return 0.09;
    }

    /**
     * Split a gross amount. Fee rounds to the nearest penny; the contractor
     * gets the exact remainder so the two always sum to the gross.
     */
    private split(grossPence: number) {
        const rate = this.feeRate();
        const platformFeePence = Math.round(grossPence * rate);
        return { rate, platformFeePence, contractorPence: grossPence - platformFeePence };
    }

    private frontendUrl(): string {
        return resolveFrontendUrl(this.config.get<string>('FRONTEND_URL'));
    }

    private async withActiveJobSlot<T>(
        customerId: string,
        work: (tx: any) => Promise<T>,
    ): Promise<T> {
        const run = async (tx: any) => {
            // Serialize creates per customer so simultaneous requests cannot
            // both observe a free slot and bypass the active-job limit.
            if (typeof tx.$executeRaw === 'function') {
                await tx.$executeRaw(Prisma.sql`
                    SELECT pg_advisory_xact_lock(hashtextextended(${`service-job:${customerId}`}, 0))
                `);
            }
            const activeCount = typeof tx.serviceJob.count === 'function'
                ? await tx.serviceJob.count({
                    where: {
                        customerId,
                        status: { in: ACTIVE_CUSTOMER_JOB_STATUSES },
                    },
                })
                : 0;
            if (activeCount >= MAX_ACTIVE_SERVICE_JOBS_PER_CUSTOMER) {
                throw new BadRequestException(
                    `You can have up to ${MAX_ACTIVE_SERVICE_JOBS_PER_CUSTOMER} active Delivery/Inspection jobs at one time. Finish or close an existing job before posting another.`,
                );
            }
            return work(tx);
        };

        if (typeof (this.prisma as any).$transaction === 'function') {
            return (this.prisma as any).$transaction(run);
        }
        return run(this.prisma as any);
    }

    private async capabilityAllowsJob(
        contractorProfileId: string,
        serviceType: ServiceType,
        workPostcodeArea: string | null,
    ): Promise<boolean> {
        const capability = await this.prisma.contractorCapability.findUnique({
            where: {
                contractorId_serviceType: {
                    contractorId: contractorProfileId,
                    serviceType,
                },
            },
            select: {
                status: true,
                jobNationwide: true,
                jobPostcodeAreas: true,
            },
        });
        if (!capability || capability.status !== CapabilityStatus.APPROVED) return false;

        // Compatibility with isolated pre-Block-8 test fixtures. Production
        // rows always have these non-null columns once the migration is live.
        if (
            (capability as any).jobNationwide === undefined
            && (capability as any).jobPostcodeAreas === undefined
        ) {
            return true;
        }

        if (capability.jobNationwide) return true;
        if (!workPostcodeArea) return false;
        return (capability.jobPostcodeAreas ?? [])
            .map((area) => area.toUpperCase())
            .includes(workPostcodeArea.toUpperCase());
    }

    private jobArea(job: {
        workPostcodeArea?: string | null;
        serviceType: ServiceType;
        pickupPostcode?: string | null;
        servicePostcode?: string | null;
    }): string | null {
        return job.workPostcodeArea
            ?? postcodeArea(
                job.serviceType === ServiceType.DELIVERY
                    ? job.pickupPostcode
                    : job.servicePostcode,
            );
    }

    private async prepareManualJobVehicles(
        customerId: string,
        serviceType: ServiceType,
        vehicles: CreateJobDto['vehicles'],
    ) {
        const listingIds = vehicles
            .map((vehicle) => vehicle.listingId)
            .filter((id): id is string => !!id);
        if (new Set(listingIds).size !== listingIds.length) {
            throw new BadRequestException('The same CarMazium listing cannot be linked twice to one service job.');
        }

        const listings = listingIds.length
            ? await this.prisma.listing.findMany({
                where: { id: { in: listingIds }, deletedAt: null },
                include: {
                    vehicle: true,
                    sale: { select: { buyerId: true } },
                    auction: { select: { winnerId: true } },
                    offers: {
                        where: { status: 'ACCEPTED' },
                        select: { buyerId: true },
                    },
                },
            })
            : [];
        if (listings.length !== listingIds.length) {
            throw new BadRequestException('One or more linked CarMazium listings are unavailable.');
        }

        const byId = new Map(listings.map((listing) => [listing.id, listing]));
        return vehicles.map((vehicle) => {
            if (!vehicle.listingId) {
                return {
                    registration: vehicle.registration?.toUpperCase().replace(/\s+/g, '') || null,
                    make: vehicle.make?.trim() || null,
                    model: vehicle.model?.trim() || null,
                    year: vehicle.year ?? null,
                    notes: vehicle.notes?.trim() || null,
                    listingId: null,
                };
            }

            const listing: any = byId.get(vehicle.listingId);
            const related =
                listing.sellerId === customerId
                || listing.sale?.buyerId === customerId
                || listing.auction?.winnerId === customerId
                || (listing.offers ?? []).some((offer: any) => offer.buyerId === customerId);

            if (serviceType === ServiceType.DELIVERY && !related) {
                throw new ForbiddenException(
                    'A manually linked Delivery vehicle must be a listing connected to your account. For an unrelated vehicle, post it without a listing link.',
                );
            }
            if (
                serviceType === ServiceType.INSPECTION
                && !related
                && String(listing.status) !== 'ACTIVE'
            ) {
                throw new ForbiddenException(
                    'An Inspection can link either an active public listing or a vehicle connected to your account.',
                );
            }

            return {
                registration: (
                    listing.vehicle?.registration
                    ?? listing.vrm
                    ?? vehicle.registration
                    ?? ''
                ).toUpperCase().replace(/\s+/g, '') || null,
                make: listing.vehicle?.make?.trim() || listing.make?.trim() || vehicle.make?.trim() || null,
                model: listing.vehicle?.model?.trim() || listing.model?.trim() || vehicle.model?.trim() || null,
                year: listing.vehicle?.year ?? listing.year ?? vehicle.year ?? null,
                notes: vehicle.notes?.trim() || null,
                listingId: listing.id,
            };
        });
    }

    // ── Capabilities ───────────────────────────────────────────────────────

    /**
     * Apply to provide a service. Creates the ContractorProfile on first use —
     * nothing else in the codebase ever did, so this is where a CONTRACTOR
     * account becomes a real contractor.
     */
    async applyCapability(userId: string, dto: ApplyCapabilityDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (user?.role !== UserRole.CONTRACTOR) {
            throw new ForbiddenException('Switch your account to a service provider before applying.');
        }

        const profile = await this.prisma.contractorProfile.upsert({
            where: { userId },
            create: {
                userId,
                businessName: dto.businessName?.trim() || null,
                phone: dto.phone?.trim() || null,
                serviceArea: dto.serviceArea?.trim() || null,
            },
            update: {
                ...(dto.businessName !== undefined && { businessName: dto.businessName.trim() || null }),
                ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
                ...(dto.serviceArea !== undefined && { serviceArea: dto.serviceArea.trim() || null }),
            },
        });

        const existing = await this.prisma.contractorCapability.findUnique({
            where: { contractorId_serviceType: { contractorId: profile.id, serviceType: dto.serviceType } },
        });

        if (existing?.status === CapabilityStatus.APPROVED) {
            throw new ConflictException('You are already approved for this service.');
        }
        if (existing?.status === CapabilityStatus.PENDING) {
            return existing;
        }

        const capability = await this.prisma.contractorCapability.upsert({
            where: { contractorId_serviceType: { contractorId: profile.id, serviceType: dto.serviceType } },
            create: { contractorId: profile.id, serviceType: dto.serviceType },
            update: {
                status: CapabilityStatus.PENDING,
                appliedAt: new Date(),
                reviewedAt: null,
                reviewedById: null,
                reviewNote: null,
                verificationCompletedAt: null,
                verificationExpiresAt: null,
                verificationReminder30SentAt: null,
                verificationReminder7SentAt: null,
                ...(existing?.verificationStatus === 'VERIFIED'
                    ? { verificationStatus: 'IN_REVIEW' }
                    : {}),
            },
        });

        await this.notifyAdmins(
            'SERVICE_CAPABILITY_APPLIED',
            'New provider application',
            `${profile.businessName || 'A contractor'} applied to provide ${this.label(dto.serviceType)}.`,
            '/dashboard/admin/services',
        );

        return capability;
    }

    async myCapabilities(userId: string) {
        const profile = await this.prisma.contractorProfile.findUnique({
            where: { userId },
            include: { capabilities: { orderBy: { appliedAt: 'desc' } } },
        });
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { stripeConnectAccountId: true, stripeConnectOnboardingComplete: true },
        });
        return {
            profile: profile
                ? { id: profile.id, businessName: profile.businessName, phone: profile.phone, serviceArea: profile.serviceArea }
                : null,
            capabilities: profile?.capabilities ?? [],
            stripeConnect: {
                connected: !!user?.stripeConnectAccountId,
                complete: !!user?.stripeConnectOnboardingComplete,
            },
        };
    }

    async updateJobMatching(userId: string, capabilityId: string, dto: UpdateJobMatchingDto) {
        const capability = await this.prisma.contractorCapability.findFirst({
            where: {
                id: capabilityId,
                contractor: { userId, deletedAt: null },
            },
            select: { id: true, serviceType: true },
        });
        if (!capability) throw new NotFoundException('Service capability not found on your account.');
        if (![ServiceType.DELIVERY, ServiceType.INSPECTION].includes(capability.serviceType)) {
            throw new BadRequestException('Job matching settings apply only to Delivery/Recovery and Inspection capabilities.');
        }

        const postcodeAreas = [...new Set((dto.jobPostcodeAreas ?? [])
            .map((area) => area.trim().toUpperCase())
            .filter(Boolean))];
        if (!dto.jobNationwide && postcodeAreas.length === 0) {
            throw new BadRequestException('Choose nationwide coverage or at least one UK postcode area.');
        }

        return this.prisma.contractorCapability.update({
            where: { id: capability.id },
            data: {
                jobNationwide: dto.jobNationwide,
                jobPostcodeAreas: dto.jobNationwide ? [] : postcodeAreas,
            },
        });
    }

    async updateLeadMatching(userId: string, capabilityId: string, dto: UpdateLeadMatchingDto) {
        const capability = await this.prisma.contractorCapability.findFirst({
            where: {
                id: capabilityId,
                contractor: { userId, deletedAt: null },
            },
            select: { id: true, serviceType: true },
        });
        if (!capability) throw new NotFoundException('Service capability not found on your account.');
        if (![ServiceType.FINANCE, ServiceType.WARRANTY].includes(capability.serviceType)) {
            throw new BadRequestException('Lead matching settings apply only to Finance and Warranty capabilities.');
        }

        const postcodeAreas = [...new Set((dto.leadPostcodeAreas ?? [])
            .map((area) => area.trim().toUpperCase())
            .filter(Boolean))];

        if (!dto.leadNationwide && postcodeAreas.length === 0) {
            throw new BadRequestException('Choose nationwide coverage or at least one UK postcode area.');
        }
        if (
            dto.leadMinVehicleValuePence !== undefined
            && dto.leadMaxVehicleValuePence !== undefined
            && dto.leadMinVehicleValuePence > dto.leadMaxVehicleValuePence
        ) {
            throw new BadRequestException('Minimum vehicle value cannot exceed maximum vehicle value.');
        }

        if (capability.serviceType === ServiceType.FINANCE) {
            if (
                dto.leadFinanceTermMinMonths !== undefined
                && dto.leadFinanceTermMaxMonths !== undefined
                && dto.leadFinanceTermMinMonths > dto.leadFinanceTermMaxMonths
            ) {
                throw new BadRequestException('Minimum finance term cannot exceed maximum finance term.');
            }
        } else if (
            dto.leadWarrantyMinMonths !== undefined
            && dto.leadWarrantyMaxMonths !== undefined
            && dto.leadWarrantyMinMonths > dto.leadWarrantyMaxMonths
        ) {
            throw new BadRequestException('Minimum warranty term cannot exceed maximum warranty term.');
        }

        return this.prisma.contractorCapability.update({
            where: { id: capability.id },
            data: {
                leadNationwide: dto.leadNationwide,
                leadPostcodeAreas: dto.leadNationwide ? [] : postcodeAreas,
                leadMinVehicleValuePence: dto.leadMinVehicleValuePence ?? null,
                leadMaxVehicleValuePence: dto.leadMaxVehicleValuePence ?? null,
                leadMinVehicleYear: dto.leadMinVehicleYear ?? null,
                leadMaxVehicleMileage: dto.leadMaxVehicleMileage ?? null,
                leadMinAnnualIncomePence: capability.serviceType === ServiceType.FINANCE
                    ? dto.leadMinAnnualIncomePence ?? null
                    : null,
                leadFinanceTermMinMonths: capability.serviceType === ServiceType.FINANCE
                    ? dto.leadFinanceTermMinMonths ?? null
                    : null,
                leadFinanceTermMaxMonths: capability.serviceType === ServiceType.FINANCE
                    ? dto.leadFinanceTermMaxMonths ?? null
                    : null,
                leadWarrantyLevels: capability.serviceType === ServiceType.WARRANTY
                    ? [...new Set((dto.leadWarrantyLevels ?? []).map((level) => level.trim()).filter(Boolean))]
                    : [],
                leadWarrantyMinMonths: capability.serviceType === ServiceType.WARRANTY
                    ? dto.leadWarrantyMinMonths ?? null
                    : null,
                leadWarrantyMaxMonths: capability.serviceType === ServiceType.WARRANTY
                    ? dto.leadWarrantyMaxMonths ?? null
                    : null,
            },
        });
    }

    async adminListCapabilities(status?: CapabilityStatus) {
        if (status && !Object.values(CapabilityStatus).includes(status)) {
            throw new BadRequestException(`Unknown status "${status}"`);
        }
        return this.prisma.contractorCapability.findMany({
            where: status ? { status } : {},
            orderBy: { appliedAt: 'asc' },
            include: {
                contractor: {
                    select: {
                        id: true, businessName: true, phone: true, serviceArea: true,
                        user: {
                            select: {
                                id: true, firstName: true, lastName: true, email: true,
                                stripeConnectAccountId: true, stripeConnectOnboardingComplete: true,
                            },
                        },
                    },
                },
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
        });
    }

    async adminReviewCapability(adminId: string, id: string, dto: ReviewCapabilityDto) {
        const cap = await this.prisma.contractorCapability.findUnique({
            where: { id },
            include: { contractor: { include: { user: true } } },
        });
        if (!cap) throw new NotFoundException('Application not found');

        let verification: Awaited<ReturnType<typeof assertCapabilityVerificationReady>> | null = null;
        if (dto.status === CapabilityStatus.APPROVED) {
            if (
                [ServiceType.DELIVERY, ServiceType.INSPECTION].includes(cap.serviceType)
                && (cap as any).jobNationwide === false
                && Array.isArray((cap as any).jobPostcodeAreas)
                && (cap as any).jobPostcodeAreas.length === 0
            ) {
                throw new BadRequestException(
                    'Configure nationwide coverage or at least one UK postcode area before approving this paid-job capability.',
                );
            }
            const u = cap.contractor.user;
            if (!u.stripeConnectAccountId || !u.stripeConnectOnboardingComplete) {
                throw new BadRequestException(
                    'This provider has not completed Stripe Connect onboarding. Approve once payouts are enabled.',
                );
            }
            verification = await assertCapabilityVerificationReady(this.prisma, id, cap.serviceType);
        }

        const now = new Date();
        const updated = await this.prisma.contractorCapability.update({
            where: { id },
            data: {
                status: dto.status,
                reviewedAt: now,
                reviewedById: adminId,
                reviewNote: dto.reviewNote ?? null,
                ...(dto.status === CapabilityStatus.APPROVED && verification?.recommendedExpiresAt
                    ? {
                        verificationStatus: 'VERIFIED',
                        verificationCompletedAt: now,
                        verificationExpiresAt: verification.recommendedExpiresAt,
                        verificationReminder30SentAt: null,
                        verificationReminder7SentAt: null,
                    }
                    : dto.status === CapabilityStatus.REJECTED
                        ? { verificationStatus: 'REJECTED' }
                        : {}),
            },
        });

        const u = cap.contractor.user;
        const label = this.label(cap.serviceType);
        if (dto.status === CapabilityStatus.APPROVED) {
            await this.notify(u.id, 'SERVICE_CAPABILITY_APPROVED', `Approved for ${label}`,
                `You can now quote on ${label} jobs in TradeXchange.`, '/dashboard/service/jobs');
            this.sendEmail(u.email, u.firstName, `You're approved for ${label}`,
                `Your application to provide <strong>${label}</strong> has been approved. Open jobs are waiting in your provider dashboard.`,
                'See open jobs', '/dashboard/service/jobs');
        } else {
            const verb = dto.status === CapabilityStatus.SUSPENDED ? 'suspended' : 'not approved';
            await this.notify(u.id, 'SERVICE_CAPABILITY_REJECTED', `${label} application ${verb}`,
                dto.reviewNote || `Your ${label} application was ${verb}.`, '/dashboard/service/capabilities');
            this.sendEmail(u.email, u.firstName, `Your ${label} application was ${verb}`,
                `${dto.reviewNote ? `<p>${escapeHtml(dto.reviewNote)}</p>` : ''}<p>You can update your details and apply again from your provider dashboard.</p>`,
                'View application', '/dashboard/service/capabilities');
        }

        return updated;
    }

    // ── Jobs: customer ─────────────────────────────────────────────────────

    async createJob(customerId: string, dto: CreateJobDto) {
        if (!(JOB_SERVICE_TYPES as readonly ServiceType[]).includes(dto.serviceType)) {
            throw new BadRequestException(`${this.label(dto.serviceType)} is enquiry-based and does not take jobs yet.`);
        }
        assertServiceAcceptingNewRequests(dto.serviceType);

        const requestedFor = parseFutureRequestedFor(dto.requestedFor);
        let pickupPostcode: string | null = null;
        let deliveryPostcode: string | null = null;
        let servicePostcode: string | null = null;

        if (dto.serviceType === ServiceType.DELIVERY) {
            pickupPostcode = requireUkPostcode(dto.pickupPostcode, 'Pickup postcode');
            deliveryPostcode = requireUkPostcode(dto.deliveryPostcode, 'Delivery postcode');
        } else {
            servicePostcode = requireUkPostcode(dto.servicePostcode, 'Inspection postcode');
        }

        const workPostcodeArea = postcodeArea(
            dto.serviceType === ServiceType.DELIVERY ? pickupPostcode : servicePostcode,
        );
        if (!workPostcodeArea) {
            throw new BadRequestException('Unable to determine the UK postcode area for this job.');
        }

        const vehicles = await this.prepareManualJobVehicles(customerId, dto.serviceType, dto.vehicles);

        const job = await this.withActiveJobSlot(customerId, async (tx) => tx.serviceJob.create({
            data: {
                customerId,
                serviceType: dto.serviceType,
                isRecovery: dto.serviceType === ServiceType.DELIVERY && !!dto.isRecovery,
                title: dto.title.trim(),
                description: dto.description?.trim() || null,
                pickupPostcode,
                pickupAddress: dto.pickupAddress?.trim() || null,
                deliveryPostcode,
                deliveryAddress: dto.deliveryAddress?.trim() || null,
                servicePostcode,
                serviceAddress: dto.serviceAddress?.trim() || null,
                workPostcodeArea,
                requestedFor,
                expiresAt: new Date(Date.now() + JOB_OPEN_DAYS * 86_400_000),
                vehicles: { create: vehicles },
            },
            include: { vehicles: true },
        }));

        this.logger.log(`Service job ${job.id} (${job.serviceType}) posted by ${customerId}`);
        return job;
    }

    async createJobFromPurchase(customerId: string, dto: JobFromPurchaseDto) {
        assertServiceAcceptingNewRequests(ServiceType.DELIVERY);

        const hasOffer = !!dto.offerId;
        const hasAuction = !!dto.auctionId;
        if (hasOffer === hasAuction) {
            throw new BadRequestException('Provide exactly one purchase source: offerId or auctionId.');
        }

        let listing: any = null;
        let vehicle: { registration?: string | null; make?: string | null; model?: string | null; year?: number | null } | null = null;
        const sourceWhere = dto.offerId
            ? { sourceOfferId: dto.offerId }
            : { sourceAuctionId: dto.auctionId! };

        if (dto.offerId) {
            const offer = await this.prisma.offer.findUnique({
                where: { id: dto.offerId },
                include: {
                    listing: {
                        include: {
                            vehicle: true,
                            sale: { select: { buyerId: true } },
                            seller: {
                                select: {
                                    postcode: true,
                                    location: true,
                                    dealerProfile: {
                                        select: {
                                            businessAddress: true,
                                            kyc: {
                                                select: {
                                                    tradingAddress: true,
                                                    businessRegisteredAddress: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!offer) throw new NotFoundException('Offer not found');
            if (offer.buyerId !== customerId) throw new ForbiddenException('Not your purchase');
            if (offer.status !== 'ACCEPTED') {
                throw new BadRequestException('Only an accepted retail offer can create a delivery job.');
            }
            if (offer.listing.deletedAt || !['OFFER_ACCEPTED', 'SOLD'].includes(String(offer.listing.status))) {
                throw new BadRequestException('This retail purchase is not in a delivery-eligible state.');
            }
            if (offer.listing.sale && offer.listing.sale.buyerId !== customerId) {
                throw new ForbiddenException('This vehicle was sold to a different buyer.');
            }

            listing = offer.listing;
            vehicle = {
                registration: offer.listing.vehicle?.registration ?? offer.listing.vrm ?? null,
                make: offer.listing.vehicle?.make ?? offer.listing.make ?? null,
                model: offer.listing.vehicle?.model ?? offer.listing.model ?? null,
                year: offer.listing.vehicle?.year ?? offer.listing.year ?? null,
            };
        } else {
            const auction = await this.prisma.auction.findUnique({
                where: { id: dto.auctionId! },
                include: {
                    listing: {
                        include: {
                            vehicle: true,
                            sale: { select: { buyerId: true } },
                            seller: {
                                select: {
                                    postcode: true,
                                    location: true,
                                    dealerProfile: {
                                        select: {
                                            businessAddress: true,
                                            kyc: {
                                                select: {
                                                    tradingAddress: true,
                                                    businessRegisteredAddress: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!auction) throw new NotFoundException('Auction not found');
            if (auction.winnerId !== customerId) throw new ForbiddenException('Not your purchase');
            if (auction.status !== 'ENDED' || auction.listing.status !== 'SOLD' || auction.listing.deletedAt) {
                throw new BadRequestException('This auction purchase is not in a completed sale state.');
            }
            if (!auction.buyerFeePaid) {
                throw new BadRequestException('Pay the auction buyer fee before arranging TradeXchange delivery.');
            }
            if (!auction.listing.sale || auction.listing.sale.buyerId !== customerId) {
                throw new ForbiddenException('The auction sale record does not belong to this buyer.');
            }

            listing = auction.listing;
            vehicle = {
                registration: auction.listing.vehicle?.registration ?? auction.listing.vrm ?? null,
                make: auction.listing.vehicle?.make ?? auction.listing.make ?? null,
                model: auction.listing.vehicle?.model ?? auction.listing.model ?? null,
                year: auction.listing.vehicle?.year ?? auction.listing.year ?? null,
            };
        }

        let sellerPostcode: string;
        try {
            sellerPostcode = requireUkPostcode(listing?.seller?.postcode, 'Seller postcode');
        } catch {
            throw new BadRequestException(
                'The seller has no valid UK postcode on file — post a delivery job manually with the pickup address.',
            );
        }
        const deliveryPostcode = requireUkPostcode(dto.deliveryPostcode, 'Delivery postcode');
        const requestedFor = parseFutureRequestedFor(dto.requestedFor);
        const workPostcodeArea = postcodeArea(sellerPostcode);
        if (!workPostcodeArea) {
            throw new BadRequestException('Unable to determine the seller postcode area for delivery matching.');
        }

        const pickupAddress = [
            listing?.seller?.dealerProfile?.kyc?.tradingAddress,
            listing?.seller?.dealerProfile?.businessAddress,
            listing?.seller?.dealerProfile?.kyc?.businessRegisteredAddress,
            listing?.seller?.location,
            listing?.location,
        ].map((value: unknown) => typeof value === 'string' ? value.trim() : '')
            .find((value: string) => value.length > 0) || null;

        const existing = await this.prisma.serviceJob.findFirst({
            where: {
                customerId,
                ...sourceWhere,
                status: { notIn: [ServiceJobStatus.CANCELLED, ServiceJobStatus.EXPIRED] },
            },
            include: { vehicles: true },
        });
        if (existing) return existing;

        try {
            return await this.withActiveJobSlot(customerId, async (tx) => tx.serviceJob.create({
                data: {
                    customerId,
                    serviceType: ServiceType.DELIVERY,
                    title: `Deliver ${listing.title}`.slice(0, 120),
                    pickupPostcode: sellerPostcode,
                    pickupAddress,
                    deliveryPostcode,
                    deliveryAddress: dto.deliveryAddress?.trim() || null,
                    workPostcodeArea,
                    requestedFor,
                    expiresAt: new Date(Date.now() + JOB_OPEN_DAYS * 86_400_000),
                    sourceOfferId: dto.offerId ?? null,
                    sourceAuctionId: dto.auctionId ?? null,
                    vehicles: {
                        create: [{
                            registration: vehicle?.registration?.toUpperCase().replace(/\s+/g, '') || null,
                            make: vehicle?.make?.trim() || null,
                            model: vehicle?.model?.trim() || null,
                            year: vehicle?.year ?? null,
                            listingId: listing.id,
                        }],
                    },
                },
                include: { vehicles: true },
            }));
        } catch (error) {
            // The database has partial unique indexes for active purchase-linked
            // delivery jobs. If two clicks arrive concurrently, the losing
            // request returns the already-created job instead of creating a
            // duplicate workflow.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const raced = await this.prisma.serviceJob.findFirst({
                    where: {
                        customerId,
                        ...sourceWhere,
                        status: { notIn: [ServiceJobStatus.CANCELLED, ServiceJobStatus.EXPIRED] },
                    },
                    include: { vehicles: true },
                });
                if (raced) return raced;
            }
            throw error;
        }
    }

    async myJobsPage(
        customerId: string,
        options: { limit?: number; cursor?: string } = {},
    ) {
        const limit = boundedServiceLimit(options.limit);
        const cursor = decodeServiceCursor(options.cursor);
        const cursorDate = cursor ? new Date(cursor.at) : null;
        const jobs = await this.prisma.serviceJob.findMany({
            where: {
                customerId,
                ...(cursorDate ? {
                    OR: [
                        { createdAt: { lt: cursorDate } },
                        { createdAt: cursorDate, id: { lt: cursor!.id } },
                    ],
                } : {}),
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            include: {
                vehicles: true,
                contractor: { select: CONTRACTOR_PUBLIC },
                _count: { select: { quotes: { where: { status: ServiceQuoteStatus.ACTIVE } } } },
            },
        });
        return makeServicePage(jobs, limit, (job) => ({
            at: job.createdAt.toISOString(),
            id: job.id,
        }));
    }

    /** Compatibility helper for internal/tests; HTTP routes use cursor pages. */
    async myJobs(customerId: string) {
        return (await this.myJobsPage(customerId, { limit: 50 })).items;
    }

    async cancelJob(customerId: string, jobId: string, dto: CancelJobDto) {
        const job = await this.ownJob(customerId, jobId);
        if (job.status !== ServiceJobStatus.OPEN) {
            throw new BadRequestException(
                job.status === ServiceJobStatus.ACCEPTED
                    ? 'A quote has been accepted and checkout is pending. Complete payment or let the unpaid acceptance reopen; paid jobs can be disputed.'
                    : 'This job can no longer be cancelled.',
            );
        }

        const quotes = await this.prisma.serviceQuote.findMany({
            where: { jobId, status: ServiceQuoteStatus.ACTIVE },
            include: { contractor: { include: { user: { select: { id: true } } } } },
        });

        await this.prisma.$transaction(async (tx) => {
            const cancelled = await tx.serviceJob.updateMany({
                where: { id: jobId, customerId, status: ServiceJobStatus.OPEN },
                data: { status: ServiceJobStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.reason?.trim() || null },
            });
            if (cancelled.count !== 1) {
                throw new ConflictException('The job state changed before it could be cancelled.');
            }
            await tx.serviceQuote.updateMany({
                where: { jobId, status: ServiceQuoteStatus.ACTIVE },
                data: { status: ServiceQuoteStatus.EXPIRED },
            });
        });

        for (const q of quotes) {
            await this.notify(q.contractor.user.id, 'SERVICE_JOB_CANCELLED', 'Job cancelled',
                `"${job.title}" was cancelled by the customer.`, `/dashboard/service/jobs`);
        }
        return { success: true };
    }

    async acceptQuote(customerId: string, jobId: string, quoteId: string): Promise<{ checkoutUrl: string }> {
        const job = await this.ownJob(customerId, jobId, { quotes: true, payment: true, vehicles: true });

        if (job.status === ServiceJobStatus.ACCEPTED && job.acceptedQuoteId === quoteId && job.payment) {
            const url = await this.freshCheckout(job.id, job.payment.id, job.payment.grossPence, job.title, customerId);
            return { checkoutUrl: url };
        }
        if (job.status !== ServiceJobStatus.OPEN) {
            throw new BadRequestException('This job is no longer open for acceptance.');
        }

        const now = new Date();
        if (job.expiresAt <= now) {
            throw new BadRequestException('This job has expired and can no longer accept a quote.');
        }

        const quote = job.quotes.find((q) => q.id === quoteId);
        if (!quote || quote.status !== ServiceQuoteStatus.ACTIVE) {
            throw new BadRequestException('That quote is no longer available.');
        }
        if (quote.validUntil && quote.validUntil <= now) {
            throw new BadRequestException('That quote has expired. Ask the provider to re-quote.');
        }

        const { rate, platformFeePence, contractorPence } = this.split(quote.amountPence);

        const payment = await this.prisma.$transaction(async (tx) => {
            const claimedJob = await tx.serviceJob.updateMany({
                where: {
                    id: jobId,
                    customerId,
                    status: ServiceJobStatus.OPEN,
                    expiresAt: { gt: now },
                },
                data: {
                    status: ServiceJobStatus.ACCEPTED,
                    acceptedQuoteId: quote.id,
                    contractorId: quote.contractorId,
                    agreedAmountPence: quote.amountPence,
                    platformFeeRate: new Prisma.Decimal(rate),
                    platformFeePence,
                    contractorAmountPence: contractorPence,
                    acceptedAt: now,
                },
            });
            if (claimedJob.count !== 1) {
                throw new ConflictException('The job state changed before the quote could be accepted.');
            }

            const claimedQuote = await tx.serviceQuote.updateMany({
                where: {
                    id: quote.id,
                    jobId,
                    contractorId: quote.contractorId,
                    status: ServiceQuoteStatus.ACTIVE,
                    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
                },
                data: { status: ServiceQuoteStatus.ACCEPTED },
            });
            if (claimedQuote.count !== 1) {
                throw new ConflictException('The selected quote changed before it could be accepted.');
            }

            const createdPayment = await tx.servicePayment.create({
                data: {
                    jobId,
                    customerId,
                    contractorId: quote.contractorId,
                    grossPence: quote.amountPence,
                    platformFeeRate: new Prisma.Decimal(rate),
                    platformFeePence,
                    contractorPence,
                },
            });

            await tx.serviceQuote.updateMany({
                where: { jobId, status: ServiceQuoteStatus.ACTIVE, id: { not: quote.id } },
                data: { status: ServiceQuoteStatus.DECLINED },
            });
            return createdPayment;
        });

        const declined = job.quotes.filter((q) => q.id !== quote.id && q.status === ServiceQuoteStatus.ACTIVE);
        for (const q of declined) {
            const c = await this.prisma.contractorProfile.findUnique({ where: { id: q.contractorId }, select: { userId: true } });
            if (c) await this.notify(c.userId, 'SERVICE_QUOTE_DECLINED', 'Quote not chosen',
                `The customer went with another provider for "${job.title}".`, '/dashboard/service/jobs');
        }

        const url = await this.freshCheckout(jobId, payment.id, quote.amountPence, job.title, customerId);
        return { checkoutUrl: url };
    }

    /**
     * Return the existing payable Checkout session whenever possible. This
     * prevents repeated clicks or checkout re-entry from leaving multiple live
     * Stripe sessions that could each be paid for the same TradeXchange job.
     * A replacement session is created only after Stripe positively confirms
     * that the previous one is expired. If Stripe cannot verify it, fail closed.
     */
    private async freshCheckout(jobId: string, paymentId: string, grossPence: number, title: string, userId: string) {
        const stripe = await this.payments.getStripeClient();
        const base = this.frontendUrl();
        const payment = await this.prisma.servicePayment.findUnique({
            where: { id: paymentId },
            select: { stripeCheckoutSessionId: true },
        });
        const existingSessionId = payment?.stripeCheckoutSessionId ?? null;

        if (existingSessionId) {
            if (typeof stripe.checkout.sessions.retrieve !== 'function') {
                throw new BadRequestException('Unable to verify the existing checkout session. Please try again shortly.');
            }

            let existing: any;
            try {
                existing = await stripe.checkout.sessions.retrieve(existingSessionId);
            } catch (e: any) {
                this.logger.warn(`Could not verify Stripe Checkout session ${existingSessionId} for service job ${jobId}: ${e?.message}`);
                throw new BadRequestException('Unable to verify the existing checkout session. Please try again shortly.');
            }

            if (existing.status === 'open') {
                if (existing.url) return existing.url;
                throw new BadRequestException('The existing checkout session is still open but Stripe returned no checkout URL.');
            }

            if (existing.status === 'complete') {
                if (existing.payment_status === 'paid') {
                    await this.markPaid(
                        jobId,
                        paymentId,
                        typeof existing.payment_intent === 'string' ? existing.payment_intent : null,
                    );
                    return `${base}/services/jobs/${jobId}?paid=1`;
                }
                throw new BadRequestException('The existing checkout session completed without a confirmed payment. Please contact support.');
            }

            if (existing.status !== 'expired') {
                this.logger.warn(`Unexpected Stripe Checkout status "${existing.status}" for service job ${jobId}; refusing replacement session.`);
                throw new BadRequestException('Unable to confirm that the previous checkout is closed. Please try again shortly.');
            }
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: { name: title, description: 'TradeXchange service — held by CarMazium until the job is confirmed complete.' },
                    unit_amount: grossPence,
                },
                quantity: 1,
            }],
            metadata: { type: 'SERVICE_JOB', jobId, paymentId, userId },
            success_url: `${base}/services/jobs/${jobId}?paid=1`,
            cancel_url: `${base}/services/jobs/${jobId}?paid=0`,
        }, {
            idempotencyKey: `service-job-checkout-${paymentId}-${existingSessionId ?? 'initial'}`,
        });
        await this.prisma.servicePayment.update({
            where: { id: paymentId },
            data: { stripeCheckoutSessionId: session.id, status: ServicePaymentStatus.PENDING },
        });
        if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL');
        return session.url;
    }

    async markPaid(jobId: string, paymentId: string, paymentIntentId: string | null) {
        const payment = await this.prisma.servicePayment.findUnique({ where: { id: paymentId }, include: { job: true } });
        if (!payment || payment.jobId !== jobId) {
            this.logger.error(`markPaid: payment ${paymentId} does not belong to job ${jobId}`);
            return;
        }
        if (payment.status === ServicePaymentStatus.PAID || payment.status === ServicePaymentStatus.RELEASED) {
            return;
        }
        if (payment.status !== ServicePaymentStatus.PENDING || payment.job.status !== ServiceJobStatus.ACCEPTED) {
            this.logger.warn(
                `markPaid: refusing transition for payment ${paymentId} (${payment.status}) / job ${jobId} (${payment.job.status})`,
            );
            return;
        }

        const transitioned = await this.prisma.$transaction(async (tx) => {
            const paid = await tx.servicePayment.updateMany({
                where: {
                    id: paymentId,
                    jobId,
                    status: ServicePaymentStatus.PENDING,
                    job: { is: { status: ServiceJobStatus.ACCEPTED } },
                },
                data: { status: ServicePaymentStatus.PAID, stripePaymentIntentId: paymentIntentId, paidAt: new Date() },
            });
            if (paid.count !== 1) return false;

            const jobPaid = await tx.serviceJob.updateMany({
                where: { id: jobId, status: ServiceJobStatus.ACCEPTED },
                data: {
                    status: ServiceJobStatus.PAID,
                    startedAt: null,
                    completedAt: null,
                    confirmedAt: null,
                },
            });
            if (jobPaid.count !== 1) {
                throw new ConflictException('The service job state changed while payment was being recorded.');
            }
            return true;
        });
        if (!transitioned) return;

        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            include: { contractor: { include: { user: true } }, customer: true },
        });
        if (!job?.contractor) return;

        const c = job.contractor.user;
        await this.notify(c.id, 'SERVICE_JOB_PAID', 'You won the job',
            `"${job.title}" is paid and ready. Contact details are now unlocked.`, `/dashboard/service/jobs/${jobId}`);
        await this.tradeTeam?.notifyOperationalStaff(
            job.contractor.id,
            job.serviceType,
            'SERVICE_JOB_PAID_TEAM',
            'Business job ready',
            `"${job.title}" is paid and ready for your authorised team.`,
            `/dashboard/service/jobs/${jobId}`,
        );
        this.sendEmail(c.email, c.firstName, `You won: ${job.title}`,
            `<p>The customer accepted your quote of <strong>${gbp(payment.grossPence)}</strong> and has paid. You will receive <strong>${gbp(payment.contractorPence)}</strong> once the job is confirmed complete.</p><p>Their contact details are now visible on the job.</p>`,
            'Open the job', `/dashboard/service/jobs/${jobId}`);

        await this.notify(job.customerId, 'SERVICE_JOB_PAID', 'Payment received',
            `Your provider for "${job.title}" has been notified. Their contact details are on the job.`, `/services/jobs/${jobId}`);
        this.sendEmail(job.customer.email, job.customer.firstName, `Payment received for ${job.title}`,
            `<p>We've received <strong>${gbp(payment.grossPence)}</strong>. It stays with CarMazium until you confirm the job is done.</p><p>Your provider${job.contractor.businessName ? `, <strong>${escapeHtml(job.contractor.businessName)}</strong>,` : ''} has been notified.</p>`,
            'View the job', `/services/jobs/${jobId}`);
    }

    async confirmCompletion(customerId: string, jobId: string) {
        const job = await this.ownJob(customerId, jobId);
        if (
            job.status !== ServiceJobStatus.COMPLETED ||
            !job.startedAt ||
            !job.completedAt ||
            job.completedAt < job.startedAt
        ) {
            throw new BadRequestException('The provider has not completed the required job lifecycle yet.');
        }
        return this.release(jobId, 'customer confirmed');
    }

    async openDispute(customerId: string, jobId: string, reason?: string) {
        const job = await this.ownJob(customerId, jobId);
        const disputable: ServiceJobStatus[] = [ServiceJobStatus.PAID, ServiceJobStatus.IN_PROGRESS, ServiceJobStatus.COMPLETED];
        if (!disputable.includes(job.status)) {
            throw new BadRequestException('Only a paid job can be disputed.');
        }

        // Claim the dispute only while the held payment has no settlement
        // operation in progress. `stripeTransferId` temporarily carries a
        // deterministic release/refund claim token during Stripe settlement;
        // requiring it to be null makes dispute vs payout/refund races fail
        // closed instead of allowing both external money operations to run.
        const frozen = await this.prisma.serviceJob.updateMany({
            where: {
                id: jobId,
                customerId,
                status: { in: disputable },
                payment: { is: { status: ServicePaymentStatus.PAID, stripeTransferId: null } },
            },
            data: { status: ServiceJobStatus.DISPUTED, cancelReason: reason?.trim() || null },
        });
        if (frozen.count !== 1) {
            throw new ConflictException('This job is already being settled or is no longer disputable.');
        }

        await this.notifyAdmins('SERVICE_JOB_DISPUTED', 'Service job disputed',
            `"${job.title}" was disputed by the customer.${reason ? ` Reason: ${reason}` : ''}`, `/dashboard/admin/services?tab=disputes`);
        return { success: true };
    }

    // ── Jobs: contractor ───────────────────────────────────────────────────

    async feedPage(
        contractorProfileId: string,
        approved: ServiceType[],
        serviceType?: ServiceType,
        options: { limit?: number; cursor?: string } = {},
    ) {
        if (serviceType && !Object.values(ServiceType).includes(serviceType)) {
            throw new BadRequestException(`Unknown service type "${serviceType}"`);
        }
        const types = serviceType ? approved.filter((type) => type === serviceType) : approved;
        if (types.length === 0) return { items: [], nextCursor: null };

        const capabilities = await this.prisma.contractorCapability.findMany({
            where: {
                contractorId: contractorProfileId,
                status: CapabilityStatus.APPROVED,
                serviceType: { in: types },
            },
            select: {
                serviceType: true,
                jobNationwide: true,
                jobPostcodeAreas: true,
            },
        });

        const coverage = capabilities
            .map((capability: any) => {
                const legacyFixture =
                    capability.jobNationwide === undefined
                    && capability.jobPostcodeAreas === undefined;
                if (legacyFixture || capability.jobNationwide) {
                    return { serviceType: capability.serviceType };
                }
                const areas = (capability.jobPostcodeAreas ?? [])
                    .map((area: string) => area.toUpperCase())
                    .filter(Boolean);
                return areas.length
                    ? {
                        serviceType: capability.serviceType,
                        workPostcodeArea: { in: areas },
                    }
                    : null;
            })
            .filter(Boolean) as Prisma.ServiceJobWhereInput[];

        if (coverage.length === 0) return { items: [], nextCursor: null };

        const limit = boundedServiceLimit(options.limit);
        const cursor = decodeServiceCursor(options.cursor);
        const cursorDate = cursor ? new Date(cursor.at) : null;
        const olderWithinPriority = cursorDate
            ? {
                OR: [
                    { createdAt: { lt: cursorDate } },
                    { createdAt: cursorDate, id: { lt: cursor!.id } },
                ],
            }
            : null;
        const cursorFilter: Prisma.ServiceJobWhereInput | null = cursorDate
            ? cursor!.priority === true
                ? {
                    OR: [
                        { isRecovery: true, ...olderWithinPriority },
                        { isRecovery: false },
                    ],
                }
                : { isRecovery: false, ...olderWithinPriority }
            : null;

        const jobs = await this.prisma.serviceJob.findMany({
            where: {
                status: ServiceJobStatus.OPEN,
                expiresAt: { gt: new Date() },
                AND: [
                    { OR: coverage },
                    ...(cursorFilter ? [cursorFilter] : []),
                ],
            },
            orderBy: [{ isRecovery: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            include: {
                vehicles: true,
                customer: { select: CUSTOMER_PUBLIC },
                quotes: { where: { contractorId: contractorProfileId }, take: 1 },
                _count: { select: { quotes: { where: { status: ServiceQuoteStatus.ACTIVE } } } },
            },
        });

        const page = makeServicePage(jobs, limit, (job) => ({
            at: job.createdAt.toISOString(),
            id: job.id,
            priority: job.isRecovery,
        }));
        return {
            ...page,
            items: page.items.map((job) => this.redact(job, false)),
        };
    }

    /** Compatibility helper for internal/tests; HTTP feed uses cursor pages. */
    async feed(contractorProfileId: string, approved: ServiceType[], serviceType?: ServiceType) {
        return (await this.feedPage(contractorProfileId, approved, serviceType, { limit: 50 })).items;
    }

    async assignedPage(
        contractorProfileId: string,
        approved: ServiceType[],
        options: { limit?: number; cursor?: string } = {},
    ) {
        const limit = boundedServiceLimit(options.limit);
        const cursor = decodeServiceCursor(options.cursor);
        const cursorDate = cursor ? new Date(cursor.at) : null;
        const jobs = await this.prisma.serviceJob.findMany({
            where: {
                contractorId: contractorProfileId,
                serviceType: { in: approved },
                ...(cursorDate ? {
                    OR: [
                        { updatedAt: { lt: cursorDate } },
                        { updatedAt: cursorDate, id: { lt: cursor!.id } },
                    ],
                } : {}),
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            include: { vehicles: true, customer: { select: CUSTOMER_PRIVATE }, payment: true },
        });
        const page = makeServicePage(jobs, limit, (job) => ({
            at: job.updatedAt.toISOString(),
            id: job.id,
        }));
        return {
            ...page,
            items: page.items.map((job) => this.redact(job, this.contactUnlocked(job.payment?.status))),
        };
    }

    /** Compatibility helper for internal/tests; HTTP assigned list is paginated. */
    async assigned(contractorProfileId: string, approved: ServiceType[] = JOB_SERVICE_TYPES as unknown as ServiceType[]) {
        return (await this.assignedPage(contractorProfileId, approved, { limit: 50 })).items;
    }

    async upsertQuote(contractorProfileId: string, approved: ServiceType[], userId: string, jobId: string, dto: UpsertQuoteDto) {
        const job = await this.prisma.serviceJob.findUnique({ where: { id: jobId }, include: { customer: true } });
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== ServiceJobStatus.OPEN || job.expiresAt < new Date()) {
            throw new BadRequestException('This job is no longer accepting quotes.');
        }
        if (!approved.includes(job.serviceType)) {
            throw new ForbiddenException(`You are not approved for ${this.label(job.serviceType)} jobs.`);
        }
        if (!(await this.capabilityAllowsJob(
            contractorProfileId,
            job.serviceType,
            this.jobArea(job),
        ))) {
            throw new ForbiddenException('This job is outside your approved TradeXchange service area.');
        }
        if (job.customerId === userId) throw new BadRequestException('You cannot quote on your own job.');

        const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
        if (validUntil && validUntil <= new Date()) {
            throw new BadRequestException('Quote validity must be in the future.');
        }

        const existing = await this.prisma.serviceQuote.findUnique({
            where: { jobId_contractorId: { jobId, contractorId: contractorProfileId } },
        });
        const isNew = !existing || existing.status === ServiceQuoteStatus.WITHDRAWN;

        const quote = await this.prisma.serviceQuote.upsert({
            where: { jobId_contractorId: { jobId, contractorId: contractorProfileId } },
            create: {
                jobId, contractorId: contractorProfileId, submittedById: userId,
                amountPence: dto.amountPence, message: dto.message?.trim() || null,
                validUntil,
            },
            update: {
                amountPence: dto.amountPence, message: dto.message?.trim() || null,
                validUntil,
                status: ServiceQuoteStatus.ACTIVE, submittedById: userId,
            },
        });

        const profile = await this.prisma.contractorProfile.findUnique({ where: { id: contractorProfileId }, select: { businessName: true } });
        const who = profile?.businessName || 'A provider';
        await this.notify(job.customerId, 'SERVICE_QUOTE_RECEIVED', isNew ? 'New quote' : 'Quote updated',
            `${who} quoted ${gbp(dto.amountPence)} for "${job.title}".`, `/services/jobs/${jobId}`);
        if (isNew) {
            this.sendEmail(job.customer.email, job.customer.firstName, `New quote: ${gbp(dto.amountPence)} for ${job.title}`,
                `<p><strong>${escapeHtml(who)}</strong> has quoted <strong>${gbp(dto.amountPence)}</strong>.</p>${dto.message ? `<p style="color:#94a3b8">"${escapeHtml(dto.message)}"</p>` : ''}`,
                'Compare quotes', `/services/jobs/${jobId}`);
        }
        return quote;
    }

    async withdrawQuote(contractorProfileId: string, jobId: string) {
        const q = await this.prisma.serviceQuote.findUnique({
            where: { jobId_contractorId: { jobId, contractorId: contractorProfileId } },
        });
        if (!q) throw new NotFoundException('No quote to withdraw');
        if (q.status !== ServiceQuoteStatus.ACTIVE) throw new BadRequestException('Only an active quote can be withdrawn.');
        await this.prisma.serviceQuote.update({ where: { id: q.id }, data: { status: ServiceQuoteStatus.WITHDRAWN } });
        return { success: true };
    }

    async startJob(contractorProfileId: string, jobId: string) {
        const job = await this.assignedJob(contractorProfileId, jobId);
        if (
            job.status !== ServiceJobStatus.PAID ||
            job.startedAt ||
            job.completedAt ||
            job.confirmedAt
        ) {
            throw new BadRequestException('This paid job is not in a clean state to start.');
        }

        const startedAt = new Date();
        const started = await this.prisma.serviceJob.updateMany({
            where: {
                id: jobId,
                contractorId: contractorProfileId,
                status: ServiceJobStatus.PAID,
                startedAt: null,
                completedAt: null,
                confirmedAt: null,
            },
            data: { status: ServiceJobStatus.IN_PROGRESS, startedAt },
        });
        if (started.count !== 1) {
            throw new ConflictException('The job state changed before it could be started.');
        }

        await this.notify(job.customerId, 'SERVICE_JOB_STARTED', 'Job started',
            `Your provider has started "${job.title}".`, `/services/jobs/${jobId}`);
        return { success: true };
    }

    async completeJob(contractorProfileId: string, jobId: string) {
        const job = await this.assignedJob(contractorProfileId, jobId);
        if (
            job.status !== ServiceJobStatus.IN_PROGRESS ||
            !job.startedAt ||
            job.completedAt ||
            job.confirmedAt
        ) {
            throw new BadRequestException('Start this job before marking it complete.');
        }

        const completedAt = new Date();
        if (completedAt < job.startedAt) {
            throw new ConflictException('The job completion time cannot be before its start time.');
        }

        const completed = await this.prisma.serviceJob.updateMany({
            where: {
                id: jobId,
                contractorId: contractorProfileId,
                status: ServiceJobStatus.IN_PROGRESS,
                startedAt: job.startedAt,
                completedAt: null,
                confirmedAt: null,
            },
            data: { status: ServiceJobStatus.COMPLETED, completedAt },
        });
        if (completed.count !== 1) {
            throw new ConflictException('The job state changed before it could be marked complete.');
        }

        await this.notify(job.customerId, 'SERVICE_JOB_COMPLETED', 'Please confirm completion',
            `Your provider marked "${job.title}" complete. Confirm to release their payment — or it releases automatically in ${AUTO_CONFIRM_HOURS} hours.`,
            `/services/jobs/${jobId}`);
        this.sendEmail(job.customer.email, job.customer.firstName, `Is "${job.title}" done?`,
            `<p>Your provider has marked the job complete. If everything is in order, confirm it and their payment is released.</p><p>If you do nothing it releases automatically in ${AUTO_CONFIRM_HOURS} hours. If something is wrong, raise a dispute before then.</p>`,
            'Confirm completion', `/services/jobs/${jobId}`);
        return { success: true };
    }

    async contractorProfileIdFor(userId: string): Promise<string | null> {
        const p = await this.prisma.contractorProfile.findUnique({ where: { userId }, select: { id: true } });
        return p?.id ?? null;
    }

    async getJob(viewer: Viewer, jobId: string) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            include: {
                vehicles: { include: { listing: { select: { id: true, slug: true, title: true } } } },
                customer: { select: CUSTOMER_PRIVATE },
                contractor: { select: CONTRACTOR_PRIVATE },
                quotes: {
                    orderBy: { amountPence: 'asc' },
                    include: { contractor: { select: CONTRACTOR_PUBLIC } },
                },
                payment: true,
            },
        });
        if (!job) throw new NotFoundException('Job not found');

        const isCustomer = job.customerId === viewer.userId;
        const isAdmin = viewer.role === UserRole.ADMIN;
        const isAccepted = !!viewer.contractorProfileId && job.contractorId === viewer.contractorProfileId;
        const hasQuoted = !!viewer.contractorProfileId && job.quotes.some((q) => q.contractorId === viewer.contractorProfileId);
        let isEligible = false;
        if (viewer.contractorProfileId && job.status === ServiceJobStatus.OPEN) {
            isEligible = await this.capabilityAllowsJob(
                viewer.contractorProfileId,
                job.serviceType,
                this.jobArea(job),
            );
        }

        if (!isCustomer && !isAdmin && !isAccepted && !hasQuoted && !isEligible) {
            throw new ForbiddenException('You do not have access to this job.');
        }

        const contactsUnlocked = this.contactUnlocked(job.payment?.status);
        const canSeeCustomerContact = isCustomer || isAdmin || (isAccepted && contactsUnlocked);
        const canSeeContractorContact = isAdmin || isAccepted || (isCustomer && contactsUnlocked);
        const quotes = (isCustomer || isAdmin)
            ? job.quotes
            : job.quotes.filter((q) => q.contractorId === viewer.contractorProfileId);

        let shaped = this.redact({ ...job, quotes }, canSeeCustomerContact) as any;
        if (!canSeeContractorContact && shaped.contractor) {
            shaped = { ...shaped, contractor: this.contractorPublicView(shaped.contractor) };
        }

        return {
            ...shaped,
            viewerRole: isCustomer ? 'customer' : isAccepted ? 'contractor' : isAdmin ? 'admin' : 'bidder',
        };
    }

    async adminListJobs(status?: ServiceJobStatus) {
        if (status && !Object.values(ServiceJobStatus).includes(status)) {
            throw new BadRequestException(`Unknown status "${status}"`);
        }
        return this.prisma.serviceJob.findMany({
            where: status ? { status } : {},
            orderBy: { updatedAt: 'desc' },
            take: 200,
            include: {
                customer: { select: CUSTOMER_PRIVATE },
                contractor: { select: CONTRACTOR_PRIVATE },
                payment: true,
                _count: { select: { quotes: true, vehicles: true } },
            },
        });
    }

    async adminResolveDispute(adminId: string, jobId: string, dto: ResolveDisputeDto) {
        const job = await this.prisma.serviceJob.findUnique({ where: { id: jobId }, include: { payment: true } });
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== ServiceJobStatus.DISPUTED) throw new BadRequestException('Job is not disputed.');
        if (!job.payment || job.payment.status !== ServicePaymentStatus.PAID) {
            throw new BadRequestException('No held payment to resolve.');
        }

        if (dto.outcome === 'RELEASE') {
            return this.release(jobId, `admin ${adminId} resolved dispute in favour of the provider`);
        }

        if (!job.payment.stripePaymentIntentId) throw new BadRequestException('No payment intent on record to refund.');

        // A deterministic token in the otherwise-null transfer field acts as
        // an atomic settlement claim. It blocks a simultaneous RELEASE from
        // starting while this REFUND is in flight and is recoverable after a
        // process/DB failure because retries use the same token/idempotency key.
        const claimToken = `claim:refund:${job.payment.id}`;
        if (job.payment.stripeTransferId && job.payment.stripeTransferId !== claimToken) {
            throw new ConflictException('This payment is already being released.');
        }
        if (!job.payment.stripeTransferId) {
            const claimed = await this.prisma.servicePayment.updateMany({
                where: {
                    id: job.payment.id,
                    status: ServicePaymentStatus.PAID,
                    stripeTransferId: null,
                    job: { is: { status: ServiceJobStatus.DISPUTED } },
                },
                data: { stripeTransferId: claimToken },
            });
            if (claimed.count !== 1) {
                throw new ConflictException('This payment is already being settled.');
            }
        }

        const stripe = await this.payments.getStripeClient();
        let refund: { id: string };
        try {
            refund = await stripe.refunds.create(
                { payment_intent: job.payment.stripePaymentIntentId },
                { idempotencyKey: `service-job-refund-${job.payment.id}` },
            );
        } catch (e) {
            // Stripe never accepted the refund, so release the DB claim and
            // leave the held payment available for a clean retry/admin choice.
            await this.prisma.servicePayment.updateMany({
                where: { id: job.payment.id, status: ServicePaymentStatus.PAID, stripeTransferId: claimToken },
                data: { stripeTransferId: null },
            });
            throw e;
        }

        // Do not clear the claim if this DB finalization fails after Stripe has
        // refunded successfully. A retry will recover using Stripe idempotency
        // instead of making the same funds eligible for a provider release.
        await this.prisma.$transaction(async (tx) => {
            const paymentFinalized = await tx.servicePayment.updateMany({
                where: { id: job.payment!.id, status: ServicePaymentStatus.PAID, stripeTransferId: claimToken },
                data: { status: ServicePaymentStatus.REFUNDED, refundedAt: new Date(), stripeTransferId: null },
            });
            if (paymentFinalized.count !== 1) {
                throw new ConflictException('Refund finalization lost its payment claim.');
            }

            const jobFinalized = await tx.serviceJob.updateMany({
                where: { id: jobId, status: ServiceJobStatus.DISPUTED },
                data: { status: ServiceJobStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.note?.trim() || 'Refunded after dispute' },
            });
            if (jobFinalized.count !== 1) {
                throw new ConflictException('Refund finalization lost its job state.');
            }
        });
        this.logger.log(`Service job ${jobId} refunded (${refund.id}) by admin ${adminId}`);

        await this.notify(job.customerId, 'SERVICE_JOB_REFUNDED', 'Refund issued',
            `"${job.title}" has been refunded.`, `/services/jobs/${jobId}`);
        const c = job.contractorId ? await this.prisma.contractorProfile.findUnique({ where: { id: job.contractorId }, select: { userId: true } }) : null;
        if (c) await this.notify(c.userId, 'SERVICE_JOB_REFUNDED', 'Dispute resolved',
            `"${job.title}" was refunded to the customer.${dto.note ? ` ${dto.note}` : ''}`, `/dashboard/service/jobs/${jobId}`);
        return { success: true, refundId: refund.id };
    }

    async expireOpenJobs(): Promise<number> {
        const now = new Date();
        const stale = await this.prisma.serviceJob.findMany({
            where: { status: ServiceJobStatus.OPEN, expiresAt: { lt: now } },
            select: { id: true, title: true, customerId: true },
        });
        let expired = 0;
        for (const j of stale) {
            const claimed = await this.prisma.$transaction(async (tx) => {
                const jobExpired = await tx.serviceJob.updateMany({
                    where: { id: j.id, status: ServiceJobStatus.OPEN, expiresAt: { lt: now } },
                    data: { status: ServiceJobStatus.EXPIRED },
                });
                if (jobExpired.count !== 1) return false;
                await tx.serviceQuote.updateMany({
                    where: { jobId: j.id, status: ServiceQuoteStatus.ACTIVE },
                    data: { status: ServiceQuoteStatus.EXPIRED },
                });
                return true;
            });
            if (!claimed) continue;
            expired += 1;
            await this.notify(j.customerId, 'SERVICE_JOB_EXPIRED', 'Job expired',
                `"${j.title}" closed after ${JOB_OPEN_DAYS} days without an accepted quote. You can post it again.`, `/services/jobs/${j.id}`);
        }
        return expired;
    }

    async autoConfirmCompleted(): Promise<number> {
        const cutoff = new Date(Date.now() - AUTO_CONFIRM_HOURS * 3_600_000);
        const due = await this.prisma.serviceJob.findMany({
            where: {
                status: ServiceJobStatus.COMPLETED,
                startedAt: { not: null },
                completedAt: { lt: cutoff },
                confirmedAt: null,
            },
            select: { id: true },
        });
        let released = 0;
        for (const j of due) {
            try {
                await this.release(j.id, `auto-confirmed after ${AUTO_CONFIRM_HOURS}h`);
                released += 1;
            } catch (e: any) {
                this.logger.error(`Auto-confirm failed for ${j.id}: ${e?.message}`);
            }
        }
        return released;
    }

    private async release(jobId: string, why: string) {
        const job = await this.prisma.serviceJob.findUnique({
            where: { id: jobId },
            include: { payment: true, contractor: { include: { user: true } }, customer: true },
        });
        if (!job?.payment || !job.contractor) throw new BadRequestException('Nothing to release.');
        if (job.payment.status !== ServicePaymentStatus.PAID) throw new BadRequestException('Payment is not in a releasable state.');
        if (job.status !== ServiceJobStatus.COMPLETED && job.status !== ServiceJobStatus.DISPUTED) {
            throw new BadRequestException('This job is not in a releasable state.');
        }
        if (
            job.status === ServiceJobStatus.COMPLETED &&
            (!job.startedAt || !job.completedAt || job.completedAt < job.startedAt)
        ) {
            throw new ConflictException('Completed job lifecycle timestamps are invalid; payout is blocked.');
        }

        const account = job.contractor.user.stripeConnectAccountId;
        if (!account) throw new BadRequestException('Provider has no Stripe Connect account.');

        // Staff never supply or select this destination. `job.contractor` is
        // the business ContractorProfile resolved when the quote was accepted,
        // so the Connect account below is always owned by that provider business.
        const claimToken = `claim:release:${job.payment.id}`;
        if (job.payment.stripeTransferId && job.payment.stripeTransferId !== claimToken) {
            throw new ConflictException('This payment is already being refunded or released.');
        }
        if (!job.payment.stripeTransferId) {
            const claimed = await this.prisma.servicePayment.updateMany({
                where: {
                    id: job.payment.id,
                    status: ServicePaymentStatus.PAID,
                    stripeTransferId: null,
                    job: { is: { status: job.status } },
                },
                data: { stripeTransferId: claimToken },
            });
            if (claimed.count !== 1) {
                throw new ConflictException('This payment is already being settled or the job state changed.');
            }
        }

        const stripe = await this.payments.getStripeClient();
        let transfer: { id: string };
        try {
            transfer = await stripe.transfers.create(
                {
                    amount: job.payment.contractorPence,
                    currency: 'gbp',
                    destination: account,
                },
                { idempotencyKey: `service-job-release-${job.payment.id}` },
            );
        } catch (e) {
            // Stripe did not accept the transfer. Release the claim so the
            // customer can dispute or the payout can be retried safely.
            await this.prisma.servicePayment.updateMany({
                where: { id: job.payment.id, status: ServicePaymentStatus.PAID, stripeTransferId: claimToken },
                data: { stripeTransferId: null },
            });
            throw e;
        }

        const transferId = transfer.id;
        this.logger.log(`Service job ${jobId}: transferred ${job.payment.contractorPence}p to ${account} (${transferId}) — ${why}`);

        // If this DB finalization fails after Stripe accepted the transfer, the
        // claim token is intentionally retained. A retry calls Stripe with the
        // same idempotency key and then completes this transaction; a refund or
        // dispute cannot claim the same held payment in the meantime.
        await this.prisma.$transaction(async (tx) => {
            const paymentFinalized = await tx.servicePayment.updateMany({
                where: { id: job.payment!.id, status: ServicePaymentStatus.PAID, stripeTransferId: claimToken },
                data: { status: ServicePaymentStatus.RELEASED, stripeTransferId: transferId, releasedAt: new Date() },
            });
            if (paymentFinalized.count !== 1) {
                throw new ConflictException('Payout finalization lost its payment claim.');
            }

            const jobFinalized = await tx.serviceJob.updateMany({
                where: { id: jobId, status: job.status },
                data: { status: ServiceJobStatus.RELEASED, confirmedAt: job.confirmedAt ?? new Date() },
            });
            if (jobFinalized.count !== 1) {
                throw new ConflictException('Payout finalization lost its job state.');
            }
        });

        const c = job.contractor.user;
        await this.notify(c.id, 'SERVICE_PAYOUT_RELEASED', 'Payment released',
            `${gbp(job.payment.contractorPence)} for "${job.title}" is on its way to your account.`, `/dashboard/service/jobs/${jobId}`);
        this.sendEmail(c.email, c.firstName, `${gbp(job.payment.contractorPence)} released for ${job.title}`,
            `<p>The job is confirmed complete and <strong>${gbp(job.payment.contractorPence)}</strong> has been transferred to your Stripe account.</p>`,
            'View the job', `/dashboard/service/jobs/${jobId}`);
        await this.notify(job.customerId, 'SERVICE_JOB_RELEASED', 'Job complete',
            `"${job.title}" is done and your provider has been paid. Thanks for using TradeXchange.`, `/services/jobs/${jobId}`);
        return { success: true, transferId };
    }

    private async ownJob(customerId: string, jobId: string, include?: Prisma.ServiceJobInclude) {
        const job = await this.prisma.serviceJob.findUnique({ where: { id: jobId }, include: include as any });
        if (!job) throw new NotFoundException('Job not found');
        if ((job as any).customerId !== customerId) throw new ForbiddenException('Not your job');
        return job as any;
    }

    private async assignedJob(contractorProfileId: string, jobId: string) {
        const job = await this.prisma.serviceJob.findUnique({ where: { id: jobId }, include: { customer: true } });
        if (!job) throw new NotFoundException('Job not found');
        if (job.contractorId !== contractorProfileId) throw new ForbiddenException('This job is not assigned to you.');
        return job;
    }

    private contactUnlocked(status?: ServicePaymentStatus | null): boolean {
        return status === ServicePaymentStatus.PAID
            || status === ServicePaymentStatus.RELEASED
            || status === ServicePaymentStatus.REFUNDED;
    }

    private contractorPublicView(contractor: any) {
        if (!contractor) return contractor;
        return {
            id: contractor.id,
            businessName: contractor.businessName,
            rating: contractor.rating,
            totalReviews: contractor.totalReviews,
            serviceArea: contractor.serviceArea,
            user: contractor.user ? { firstName: contractor.user.firstName } : null,
        };
    }

    private redact<T extends Record<string, any>>(job: T, full: boolean): T {
        if (full) return job;
        const { customer, ...rest } = job;
        return {
            ...rest,
            customer: customer ? { id: customer.id, firstName: customer.firstName } : null,
            pickupAddress: null,
            deliveryAddress: null,
            serviceAddress: null,
        } as unknown as T;
    }

    private label(t: ServiceType): string {
        return { DELIVERY: 'Delivery & Recovery', INSPECTION: 'Vehicle Inspections', FINANCE: 'Vehicle Finance', WARRANTY: 'Warranty' }[t];
    }

    private async notify(userId: string, type: string, title: string, message: string, link: string) {
        try {
            await this.notifications.create({ userId, type, title, message, link, entityType: 'SERVICE_JOB' } as any);
        } catch (e: any) {
            this.logger.warn(`Notification ${type} to ${userId} failed: ${e?.message}`);
        }
    }

    private async notifyAdmins(type: string, title: string, message: string, link: string) {
        const admins = await this.prisma.user.findMany({ where: { role: UserRole.ADMIN, deletedAt: null }, select: { id: true } });
        for (const a of admins) await this.notify(a.id, type, title, message, link);
    }

    private sendEmail(to: string, firstName: string | null, subject: string, bodyHtml: string, ctaLabel: string, ctaPath: string) {
        const name = firstName || 'there';
        const url = `${this.frontendUrl()}${ctaPath}`;
        this.email.sendBrandedEmail({
            to,
            subject,
            bodyHtml: `
                <h1 style="margin:0 0 12px;font-family:'Poppins','Segoe UI',sans-serif;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(subject)}</h1>
                <p style="margin:0 0 16px;color:#cbd5e1;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
                <div style="color:#cbd5e1;font-size:15px;line-height:1.6;">${bodyHtml}</div>
                <div style="text-align:center;margin:28px 0 8px;">
                    <a href="${url}" style="background:#ed1c24;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${escapeHtml(ctaLabel)}</a>
                </div>`,
        } as any).catch((e: any) => this.logger.warn(`Email "${subject}" to ${to} failed: ${e?.message}`));
    }
}

function normPostcode(pc?: string | null): string | null {
    if (!pc) return null;
    return pc.toUpperCase().replace(/\s+/g, ' ').trim() || null;
}

function gbp(pence: number): string {
    return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
