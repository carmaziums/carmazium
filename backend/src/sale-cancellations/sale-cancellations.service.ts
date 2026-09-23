import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { HandoverDocumentsService } from '../auctions/handover-documents.service';
import {
    assertDealerPermission,
    resolveDealerActor,
} from '../dealers/dealer-access';
import {
    SaleCancellationEvidenceService,
    StoredCancellationEvidence,
} from './sale-cancellation-evidence.service';

const REASONS = [
    'BUYER_CHANGED_MIND',
    'SELLER_UNABLE_TO_COMPLETE',
    'VEHICLE_FAULT',
    'VEHICLE_MISDESCRIBED',
    'VEHICLE_DAMAGED',
    'PAYMENT_ISSUE',
    'MUTUAL_AGREEMENT',
    'OTHER',
] as const;

type CancellationReason = typeof REASONS[number];
type CancellationDecision = 'ACCEPT' | 'REJECT';
type AdminDecision = 'APPROVE' | 'REJECT';

const EVIDENCE_REQUIRED = new Set<CancellationReason>([
    'VEHICLE_FAULT',
    'VEHICLE_MISDESCRIBED',
    'VEHICLE_DAMAGED',
    'PAYMENT_ISSUE',
]);

const SAFETY_REVIEW_REASONS = new Set<CancellationReason>([
    'SELLER_UNABLE_TO_COMPLETE',
    'VEHICLE_FAULT',
    'VEHICLE_MISDESCRIBED',
    'VEHICLE_DAMAGED',
    'PAYMENT_ISSUE',
    'OTHER',
]);

@Injectable()
export class SaleCancellationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly payments: PaymentsService,
        private readonly handoverDocuments: HandoverDocumentsService,
        private readonly evidence: SaleCancellationEvidenceService,
    ) {}

    private assertReason(value: string): CancellationReason {
        if (!REASONS.includes(value as CancellationReason)) {
            throw new BadRequestException('Choose a valid cancellation reason.');
        }
        return value as CancellationReason;
    }

    private async actor(userId: string) {
        const dealerActor = await resolveDealerActor(this.prisma, userId);
        return {
            canonicalId: dealerActor?.ownerUserId ?? userId,
            dealerActor,
        };
    }

    private async context(listingId: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            include: {
                sale: true,
                auction: true,
                offers: {
                    where: { status: 'ACCEPTED' as any },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                },
            },
        });
        if (!listing || listing.deletedAt) throw new NotFoundException('Vehicle listing not found.');

        const acceptedOffer = listing.offers[0] ?? null;
        const sale = listing.sale ?? null;
        const auction = listing.auction ?? null;
        const buyerId = sale?.buyerId ?? auction?.winnerId ?? acceptedOffer?.buyerId ?? null;
        const sellerId = listing.sellerId;

        if (!sellerId) throw new BadRequestException('This sale has no seller account attached.');
        const hasDeal =
            !!sale ||
            (!!acceptedOffer && listing.status === 'OFFER_ACCEPTED') ||
            (!!auction && auction.status === 'ENDED' && !!auction.winnerId);

        if (!hasDeal) {
            throw new BadRequestException('There is no completed or sale-pending purchase to cancel for this vehicle.');
        }

        return { listing, sale, auction, acceptedOffer, buyerId, sellerId };
    }

    private assertBusinessPermission(
        dealerActor: Awaited<ReturnType<typeof resolveDealerActor>>,
        side: 'BUYER' | 'SELLER',
        isAuction: boolean,
    ): void {
        if (!dealerActor || dealerActor.isOwner) return;
        if (side === 'SELLER') {
            assertDealerPermission(
                dealerActor,
                'MANAGE_INVENTORY',
                'Your dealership role cannot cancel vehicle sales.',
            );
            return;
        }
        assertDealerPermission(
            dealerActor,
            isAuction ? 'PAY_AUCTION_FEE' : 'MANAGE_OFFERS',
            'Your dealership role cannot cancel purchases.',
        );
    }

    private async notifyUser(
        userId: string | null | undefined,
        title: string,
        message: string,
        requestId: string,
        link = '/dashboard/cancellations',
    ): Promise<void> {
        if (!userId) return;
        await this.notifications.create({
            userId,
            type: 'SYSTEM',
            title,
            message,
            entityType: 'SALE_CANCELLATION',
            entityId: requestId,
            link,
            actionType: 'SALE_CANCELLATION',
        }).catch(() => null);
    }

    private async notifyAdmins(title: string, message: string, requestId: string): Promise<void> {
        const admins = await this.prisma.user.findMany({
            where: { role: 'ADMIN', deletedAt: null },
            select: { id: true },
        });
        await Promise.all(admins.map((admin) =>
            this.notifyUser(admin.id, title, message, requestId, '/dashboard/admin/cancellations')
        ));
    }

    private shouldRefundBuyerFee(request: any): boolean {
        return request.requestedByRole === 'SELLER'
            || ['SELLER_UNABLE_TO_COMPLETE', 'VEHICLE_FAULT', 'VEHICLE_MISDESCRIBED', 'VEHICLE_DAMAGED', 'PAYMENT_ISSUE']
                .includes(request.reason);
    }

    private async hydrate(request: any) {
        if (!request) return request;
        const [listing, hydratedEvidence] = await Promise.all([
            this.prisma.listing.findUnique({
                where: { id: request.listingId },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    images: true,
                    type: true,
                    status: true,
                    vrm: true,
                },
            }),
            this.evidence.hydrateEvidence(request.evidence ?? []),
        ]);
        return {
            ...request,
            listing,
            evidence: hydratedEvidence,
        };
    }

    async create(
        userId: string,
        input: { listingId?: string; reason?: string; details?: string },
        files: any[],
    ) {
        if (!input.listingId) throw new BadRequestException('Vehicle listing is required.');
        const reason = this.assertReason(String(input.reason || ''));
        const details = String(input.details || '').trim();
        if (reason === 'OTHER' && details.length < 20) {
            throw new BadRequestException('Please explain the cancellation reason in at least 20 characters.');
        }

        const ctx = await this.context(input.listingId);
        const { canonicalId, dealerActor } = await this.actor(userId);
        const isSeller = canonicalId === ctx.sellerId;
        const isBuyer = !!ctx.buyerId && canonicalId === ctx.buyerId;

        if (!isSeller && !isBuyer) {
            throw new ForbiddenException('Only the buyer or seller in this transaction can request cancellation.');
        }
        this.assertBusinessPermission(dealerActor, isSeller ? 'SELLER' : 'BUYER', !!ctx.auction);

        const evidenceRequired = EVIDENCE_REQUIRED.has(reason);
        if (evidenceRequired && (!files || files.length === 0)) {
            throw new BadRequestException(
                'Photo, screenshot or video evidence is required for this cancellation reason.',
            );
        }

        const openRequest = await this.prisma.saleCancellationRequest.findFirst({
            where: {
                listingId: input.listingId,
                status: { in: ['PENDING_COUNTERPARTY', 'PENDING_ADMIN'] as any },
            },
            select: { id: true },
        });
        if (openRequest) {
            throw new BadRequestException('A cancellation request is already open for this sale.');
        }

        const requestId = randomUUID();
        let stored: StoredCancellationEvidence[] = [];
        try {
            stored = await this.evidence.storeFiles(requestId, canonicalId, files ?? []);
            const initialStatus = ctx.buyerId ? 'PENDING_COUNTERPARTY' : 'PENDING_ADMIN';
            const request = await this.prisma.saleCancellationRequest.create({
                data: {
                    id: requestId,
                    listingId: input.listingId,
                    saleId: ctx.sale?.id ?? null,
                    auctionId: ctx.auction?.id ?? null,
                    offerId: ctx.acceptedOffer?.id ?? null,
                    buyerId: ctx.buyerId,
                    sellerId: ctx.sellerId,
                    requestedById: canonicalId,
                    requestedByRole: isSeller ? 'SELLER' : 'BUYER',
                    reason: reason as any,
                    details: details || null,
                    status: initialStatus as any,
                    evidenceRequired,
                    evidence: stored.length ? {
                        create: stored.map((item) => ({
                            uploadedById: canonicalId,
                            storagePath: item.storagePath,
                            fileName: item.fileName,
                            mimeType: item.mimeType,
                            sizeBytes: item.sizeBytes,
                        })),
                    } : undefined,
                },
                include: { evidence: true },
            });

            if (ctx.buyerId) {
                const counterpartId = isSeller ? ctx.buyerId : ctx.sellerId;
                await this.notifyUser(
                    counterpartId,
                    'Sale cancellation requested',
                    `${isSeller ? 'The seller' : 'The buyer'} requested cancellation of "${ctx.listing.title}". Review the reason and evidence before responding.`,
                    request.id,
                );
            } else {
                await this.notifyAdmins(
                    'Sale cancellation needs review',
                    `A seller requested cancellation of "${ctx.listing.title}" but there is no linked buyer account to confirm it.`,
                    request.id,
                );
            }

            return this.hydrate(request);
        } catch (error) {
            if (stored.length) await this.evidence.deletePaths(stored.map((item) => item.storagePath));
            throw error;
        }
    }

    async mine(userId: string) {
        const { canonicalId } = await this.actor(userId);
        const rows = await this.prisma.saleCancellationRequest.findMany({
            where: {
                OR: [
                    { sellerId: canonicalId },
                    { buyerId: canonicalId },
                    { requestedById: canonicalId },
                ],
            },
            include: { evidence: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return Promise.all(rows.map(async (row) => {
            const hydrated = await this.hydrate(row);
            const counterpartId = row.requestedByRole === 'SELLER' ? row.buyerId : row.sellerId;
            return {
                ...hydrated,
                viewer: {
                    isRequester: row.requestedById === canonicalId,
                    canRespond: row.status === ('PENDING_COUNTERPARTY' as any) && counterpartId === canonicalId,
                    canWithdraw: ['PENDING_COUNTERPARTY', 'PENDING_ADMIN'].includes(row.status as any)
                        && row.requestedById === canonicalId,
                },
            };
        }));
    }

    async findOne(id: string, userId: string, isAdmin = false) {
        const row = await this.prisma.saleCancellationRequest.findUnique({
            where: { id },
            include: { evidence: true },
        });
        if (!row) throw new NotFoundException('Cancellation request not found.');
        if (!isAdmin) {
            const { canonicalId } = await this.actor(userId);
            if (![row.sellerId, row.buyerId, row.requestedById].filter(Boolean).includes(canonicalId)) {
                throw new ForbiddenException('You cannot view this cancellation request.');
            }
        }
        const hydrated = await this.hydrate(row);
        if (isAdmin) return { ...hydrated, viewer: { canAdminReview: row.status === ('PENDING_ADMIN' as any) } };
        const { canonicalId } = await this.actor(userId);
        const counterpartId = row.requestedByRole === 'SELLER' ? row.buyerId : row.sellerId;
        return {
            ...hydrated,
            viewer: {
                isRequester: row.requestedById === canonicalId,
                canRespond: row.status === ('PENDING_COUNTERPARTY' as any) && counterpartId === canonicalId,
                canWithdraw: ['PENDING_COUNTERPARTY', 'PENDING_ADMIN'].includes(row.status as any)
                    && row.requestedById === canonicalId,
            },
        };
    }

    async pendingAdmin() {
        const rows = await this.prisma.saleCancellationRequest.findMany({
            where: { status: 'PENDING_ADMIN' as any },
            include: { evidence: true },
            orderBy: { createdAt: 'asc' },
            take: 100,
        });
        return Promise.all(rows.map(async (row) => ({
            ...(await this.hydrate(row)),
            viewer: { canAdminReview: true },
        })));
    }

    async respond(
        id: string,
        userId: string,
        decision: CancellationDecision,
        note?: string,
    ) {
        if (!['ACCEPT', 'REJECT'].includes(decision)) {
            throw new BadRequestException('Choose ACCEPT or REJECT.');
        }
        const request = await this.prisma.saleCancellationRequest.findUnique({
            where: { id },
            include: { evidence: true },
        });
        if (!request) throw new NotFoundException('Cancellation request not found.');
        if (request.status !== ('PENDING_COUNTERPARTY' as any)) {
            throw new BadRequestException('This cancellation request is no longer waiting for a response.');
        }

        const { canonicalId, dealerActor } = await this.actor(userId);
        const counterpartId = request.requestedByRole === 'SELLER' ? request.buyerId : request.sellerId;
        if (!counterpartId || canonicalId !== counterpartId || canonicalId === request.requestedById) {
            throw new ForbiddenException('Only the other party in the sale can respond.');
        }
        this.assertBusinessPermission(dealerActor, request.requestedByRole === 'SELLER' ? 'BUYER' : 'SELLER', !!request.auctionId);

        if (decision === 'REJECT') {
            const updated = await this.prisma.saleCancellationRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED' as any,
                    counterpartRespondedById: canonicalId,
                    counterpartResponseNote: note?.trim() || null,
                    counterpartRespondedAt: new Date(),
                    resolvedAt: new Date(),
                },
                include: { evidence: true },
            });
            await this.notifyUser(
                request.requestedById,
                'Sale cancellation declined',
                'The other party declined your sale cancellation request. You can contact them or CarMazium support if the issue remains unresolved.',
                id,
            );
            return this.hydrate(updated);
        }

        const ctx = await this.context(request.listingId);
        const needsAdmin =
            !!ctx.auction?.sellerBonusReleased ||
            !!ctx.auction?.stripePayoutTransferId ||
            !!ctx.auction?.manualPayoutConfirmedAt ||
            (
                request.requestedByRole === 'BUYER'
                && EVIDENCE_REQUIRED.has(request.reason as CancellationReason)
            );

        if (needsAdmin) {
            const updated = await this.prisma.saleCancellationRequest.update({
                where: { id },
                data: {
                    status: 'PENDING_ADMIN' as any,
                    counterpartRespondedById: canonicalId,
                    counterpartResponseNote: note?.trim() || null,
                    counterpartRespondedAt: new Date(),
                },
                include: { evidence: true },
            });
            await this.notifyAdmins(
                'Agreed cancellation needs admin action',
                `Buyer and seller agreed to cancel "${ctx.listing.title}", but handover/bonus activity prevents automatic reversal.`,
                id,
            );
            return this.hydrate(updated);
        }

        await this.prisma.saleCancellationRequest.update({
            where: { id },
            data: {
                counterpartRespondedById: canonicalId,
                counterpartResponseNote: note?.trim() || null,
                counterpartRespondedAt: new Date(),
            },
        });
        return this.finalize(id);
    }

    async withdraw(id: string, userId: string) {
        const request = await this.prisma.saleCancellationRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Cancellation request not found.');
        const { canonicalId } = await this.actor(userId);
        if (request.requestedById !== canonicalId) {
            throw new ForbiddenException('Only the person who opened the request can withdraw it.');
        }
        if (!['PENDING_COUNTERPARTY', 'PENDING_ADMIN'].includes(request.status as any)) {
            throw new BadRequestException('This cancellation request can no longer be withdrawn.');
        }
        return this.prisma.saleCancellationRequest.update({
            where: { id },
            data: { status: 'WITHDRAWN' as any, resolvedAt: new Date() },
        });
    }

    async adminReview(
        id: string,
        adminId: string,
        decision: AdminDecision,
        note?: string,
    ) {
        if (!['APPROVE', 'REJECT'].includes(decision)) {
            throw new BadRequestException('Choose APPROVE or REJECT.');
        }
        const request = await this.prisma.saleCancellationRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Cancellation request not found.');
        if (request.status !== ('PENDING_ADMIN' as any)) {
            throw new BadRequestException('This request is not waiting for admin review.');
        }

        if (decision === 'REJECT') {
            const updated = await this.prisma.saleCancellationRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED' as any,
                    adminReviewedById: adminId,
                    adminNote: note?.trim() || null,
                    resolvedAt: new Date(),
                },
                include: { evidence: true },
            });
            await Promise.all([
                this.notifyUser(request.sellerId, 'Sale cancellation not approved', 'CarMazium did not approve the cancellation request.', id),
                this.notifyUser(request.buyerId, 'Sale cancellation not approved', 'CarMazium did not approve the cancellation request.', id),
            ]);
            return this.hydrate(updated);
        }

        return this.finalize(id, adminId, note);
    }

    private async finalize(id: string, adminId?: string, adminNote?: string) {
        const request = await this.prisma.saleCancellationRequest.findUnique({
            where: { id },
            include: { evidence: true },
        });
        if (!request) throw new NotFoundException('Cancellation request not found.');

        const ctx = await this.context(request.listingId);
        const refundBuyerFee =
            !!ctx.auction?.buyerFeePaid &&
            !!ctx.auction?.buyerFeeTransactionId &&
            this.shouldRefundBuyerFee(request);

        if (refundBuyerFee && ctx.auction) {
            await this.payments.issueFullRefundForAuctionCancellation(ctx.auction.id);
        }

        const linkedRetailId = ctx.auction ? ctx.listing.linkedListingId : null;
        const paidSellerBonus = !!ctx.auction && (
            !!ctx.auction.stripePayoutTransferId ||
            !!ctx.auction.manualPayoutConfirmedAt
        );
        const restoreRetailStatus = SAFETY_REVIEW_REASONS.has(request.reason as CancellationReason)
            ? 'DRAFT'
            : 'ACTIVE';
        const hadSale = !!ctx.sale;
        const handoverPrivatePath = ctx.auction?.handoverProofPath;
        const handoverLegacyUrl = ctx.auction?.handoverProofUrl;

        await this.prisma.$transaction(async (tx) => {
            await tx.sale.deleteMany({ where: { listingId: request.listingId } });

            await tx.offer.updateMany({
                where: {
                    listingId: request.listingId,
                    status: 'ACCEPTED' as any,
                },
                data: {
                    status: 'CANCELLED' as any,
                    counterExpiresAt: null,
                },
            });

            await tx.deliveryRequest.updateMany({
                where: {
                    listingId: request.listingId,
                    status: { in: ['PENDING', 'ACCEPTED'] as any },
                },
                data: {
                    status: 'CANCELLED' as any,
                    cancelledAt: new Date(),
                },
            });

            if (ctx.auction) {
                await tx.auction.update({
                    where: { id: ctx.auction.id },
                    data: {
                        status: 'CANCELLED',
                        winnerId: null,
                        winningBidAmount: null,
                        wonAt: null,
                        buyerFeePaid: refundBuyerFee ? false : ctx.auction.buyerFeePaid,
                        handoverProofUrl: null,
                        handoverProofPath: null,
                        handoverSubmittedAt: null,
                        ...(!paidSellerBonus ? {
                            sellerBonusReleased: false,
                            sellerBonusReleasedAt: null,
                        } : {}),
                    } as any,
                });

                await tx.listing.update({
                    where: { id: request.listingId },
                    data: linkedRetailId
                        ? {
                            status: 'DRAFT',
                            linkedListingId: null,
                            deletedAt: new Date(),
                        } as any
                        : {
                            status: 'DRAFT',
                            linkedListingId: null,
                        } as any,
                });

                if (linkedRetailId) {
                    await tx.listing.update({
                        where: { id: linkedRetailId },
                        data: {
                            status: restoreRetailStatus as any,
                            linkedListingId: null,
                        } as any,
                    });
                }
            } else {
                await tx.listing.update({
                    where: { id: request.listingId },
                    data: { status: restoreRetailStatus as any },
                });
            }

            if (hadSale) {
                await tx.sellerProfile.updateMany({
                    where: { userId: request.sellerId, totalSales: { gt: 0 } },
                    data: { totalSales: { decrement: 1 } },
                });
            }

            await tx.saleCancellationRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED' as any,
                    buyerFeeRefunded: refundBuyerFee,
                    sellerBonusRecoveryRequired: paidSellerBonus,
                    adminReviewedById: adminId ?? request.adminReviewedById,
                    adminNote: adminNote?.trim() || request.adminNote,
                    resolvedAt: new Date(),
                },
            });
        });

        if (ctx.auction && (handoverPrivatePath || handoverLegacyUrl)) {
            await this.handoverDocuments.deleteProof(handoverPrivatePath, handoverLegacyUrl).catch(() => {});
        }

        const feeMessage = refundBuyerFee
            ? ' The £125 auction buyer fee has been refunded in full.'
            : (ctx.auction?.buyerFeePaid ? ' The auction buyer fee was not automatically refunded under this cancellation reason.' : '');

        await Promise.all([
            this.notifyUser(
                request.sellerId,
                'Sale cancelled',
                `The sale of "${ctx.listing.title}" has been cancelled and the vehicle returned to seller control.${feeMessage}`,
                id,
            ),
            this.notifyUser(
                request.buyerId,
                'Purchase cancelled',
                `Your purchase of "${ctx.listing.title}" has been cancelled.${feeMessage}`,
                id,
            ),
        ]);

        const updated = await this.prisma.saleCancellationRequest.findUnique({
            where: { id },
            include: { evidence: true },
        });
        return this.hydrate(updated);
    }
}
