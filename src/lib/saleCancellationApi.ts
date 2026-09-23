import { apiClient } from './apiClient';

export type SaleCancellationStatus =
    | 'PENDING_COUNTERPARTY'
    | 'PENDING_ADMIN'
    | 'APPROVED'
    | 'REJECTED'
    | 'WITHDRAWN';

export type SaleCancellationReason =
    | 'BUYER_CHANGED_MIND'
    | 'SELLER_UNABLE_TO_COMPLETE'
    | 'VEHICLE_FAULT'
    | 'VEHICLE_MISDESCRIBED'
    | 'VEHICLE_DAMAGED'
    | 'PAYMENT_ISSUE'
    | 'MUTUAL_AGREEMENT'
    | 'OTHER';

export interface SaleCancellationEvidence {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    url?: string | null;
}

export interface SaleCancellationRequest {
    id: string;
    listingId: string;
    saleId?: string | null;
    auctionId?: string | null;
    offerId?: string | null;
    buyerId?: string | null;
    sellerId: string;
    requestedById: string;
    requestedByRole: 'BUYER' | 'SELLER';
    reason: SaleCancellationReason;
    details?: string | null;
    status: SaleCancellationStatus;
    evidenceRequired: boolean;
    buyerFeeRefunded: boolean;
    sellerBonusRecoveryRequired: boolean;
    counterpartResponseNote?: string | null;
    adminNote?: string | null;
    createdAt: string;
    resolvedAt?: string | null;
    listing?: {
        id: string;
        title: string;
        slug: string;
        images: string[];
        type: 'AUCTION' | 'CLASSIFIED';
        status: string;
        vrm?: string | null;
    } | null;
    evidence: SaleCancellationEvidence[];
    viewer?: {
        isRequester?: boolean;
        canRespond?: boolean;
        canWithdraw?: boolean;
        canAdminReview?: boolean;
    };
}

export const SALE_CANCELLATION_REASON_LABELS: Record<SaleCancellationReason, string> = {
    BUYER_CHANGED_MIND: 'Buyer changed mind',
    SELLER_UNABLE_TO_COMPLETE: 'Seller cannot complete the sale',
    VEHICLE_FAULT: 'Vehicle fault found',
    VEHICLE_MISDESCRIBED: 'Vehicle was misdescribed',
    VEHICLE_DAMAGED: 'Vehicle damage / condition issue',
    PAYMENT_ISSUE: 'Payment problem',
    MUTUAL_AGREEMENT: 'Buyer and seller mutually agreed',
    OTHER: 'Other reason',
};

export const SALE_CANCELLATION_EVIDENCE_REQUIRED = new Set<SaleCancellationReason>([
    'VEHICLE_FAULT',
    'VEHICLE_MISDESCRIBED',
    'VEHICLE_DAMAGED',
    'PAYMENT_ISSUE',
]);

export async function createSaleCancellation(input: {
    listingId: string;
    reason: SaleCancellationReason;
    details?: string;
    evidence?: File[];
}): Promise<SaleCancellationRequest> {
    const body = new FormData();
    body.append('listingId', input.listingId);
    body.append('reason', input.reason);
    if (input.details?.trim()) body.append('details', input.details.trim());
    for (const file of input.evidence ?? []) body.append('evidence', file);

    const response = await apiClient<{ data: SaleCancellationRequest }>('/sale-cancellations', {
        method: 'POST',
        body,
    });
    return response.data;
}

export async function getMySaleCancellations(): Promise<SaleCancellationRequest[]> {
    const response = await apiClient<{ data: SaleCancellationRequest[] }>('/sale-cancellations/mine', {
        cache: 'no-store',
    });
    return response.data ?? [];
}

export async function respondToSaleCancellation(
    id: string,
    decision: 'ACCEPT' | 'REJECT',
    note?: string,
): Promise<SaleCancellationRequest> {
    const response = await apiClient<{ data: SaleCancellationRequest }>(`/sale-cancellations/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
    });
    return response.data;
}

export async function withdrawSaleCancellation(id: string): Promise<void> {
    await apiClient(`/sale-cancellations/${id}/withdraw`, { method: 'POST' });
}

export async function getAdminPendingSaleCancellations(): Promise<SaleCancellationRequest[]> {
    const response = await apiClient<{ data: SaleCancellationRequest[] }>('/sale-cancellations/admin/pending', {
        cache: 'no-store',
    });
    return response.data ?? [];
}

export async function adminReviewSaleCancellation(
    id: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
    refundBuyerFee?: boolean,
): Promise<SaleCancellationRequest> {
    const response = await apiClient<{ data: SaleCancellationRequest }>(`/sale-cancellations/${id}/admin-review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
    });
    return response.data;
}
