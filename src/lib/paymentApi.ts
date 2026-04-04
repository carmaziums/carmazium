/**
 * Payment API Client
 */
import { apiClient } from './apiClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CheckoutSessionResult {
    url: string
    sessionId: string
    transactionId: string
}

export interface SessionStatus {
    status: string
    paymentStatus: string
    customerEmail: string | null
    metadata: Record<string, string>
}

export interface PaymentTransaction {
    id: string
    listingId: string
    amount: string | number
    type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'REFUND'
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
    stripePaymentId: string | null
    description: string | null
    createdAt: string
    listing?: {
        id: string
        title: string
        slug: string
        images: string[]
        make: string | null
        model: string | null
        year: number | null
    }
}

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session and get the redirect URL.
 */
export async function createCheckoutSession(
    listingId: string,
    amount: number,
    type: 'DEPOSIT' | 'FULL_PAYMENT' = 'FULL_PAYMENT',
    currency = 'gbp',
): Promise<CheckoutSessionResult> {
    const data = await apiClient<{ data: CheckoutSessionResult }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ listingId, amount, type, currency }),
    })
    return data.data
}

/**
 * Poll the status of a Stripe Checkout Session.
 */
export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const data = await apiClient<{ data: SessionStatus }>(`/payments/session-status/${sessionId}`, {
        method: 'GET',
    })
    return data.data
}

/**
 * Fetch payment history for the current user.
 */
export async function getPaymentHistory(): Promise<PaymentTransaction[]> {
    const data = await apiClient<{ data: PaymentTransaction[] }>('/payments/history', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}
