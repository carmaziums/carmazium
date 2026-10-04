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
    amountTotal: number | null
    currency: string | null
}

export interface PaymentTransaction {
    id: string
    listingId: string | null
    amount: string | number
    type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'REFUND' | 'HPI_REPORT' | 'HPI_REPORT_EMAIL' | 'LISTING_FEE' | 'BOOST' | 'KYC_VERIFICATION'
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
    type: 'COMMISSION' = 'COMMISSION',
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
 * Webhook fallback: apply the £125 auction buyer fee if the Stripe webhook was delayed.
 */
export async function applyAuctionFee(sessionId: string): Promise<{ applied: boolean }> {
    const data = await apiClient<{ data: { applied: boolean } }>('/payments/apply-auction-fee', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
    })
    return data.data
}

/**
 * Webhook fallback: apply the £1 dealer KYC verification fee if the Stripe webhook was delayed.
 */
export async function applyKycFee(sessionId: string): Promise<{ applied: boolean }> {
    const data = await apiClient<{ data: { applied: boolean } }>('/payments/apply-kyc-fee', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
    })
    return data.data
}

/**
 * Webhook fallback: generate the HPI report if the Stripe webhook was delayed or missed.
 */
export async function applyHpiFee(sessionId: string): Promise<{ applied: boolean }> {
    const data = await apiClient<{ data: { applied: boolean } }>('/payments/apply-hpi-fee', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
    })
    return data.data
}

/**
 * Webhook fallback: register the buyer's paid HPI report email delivery if the Stripe webhook was delayed or missed.
 */
export async function applyHpiEmailFee(sessionId: string): Promise<{ applied: boolean }> {
    const data = await apiClient<{ data: { applied: boolean } }>('/payments/apply-hpi-email-fee', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
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


/**
 * Stripe webhooks may complete slightly after the browser returns from
 * Checkout. An early pending response or a transient network failure must
 * not permanently suppress a genuine paid conversion.
 *
 * Returns null when no authoritative paid session can be confirmed.
 * This helper never infers payment success from reaching the return URL.
 */
export async function waitForPaidCheckoutSession(
    sessionId: string,
    lookup: (id: string) => Promise<SessionStatus> = getSessionStatus,
    attempts = 5,
    pauseMs = 1200,
): Promise<SessionStatus | null> {
    if (!sessionId || attempts < 1 || attempts > 10) return null
    let lastStatus: SessionStatus | null = null

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            lastStatus = await lookup(sessionId)
            if (lastStatus?.paymentStatus === 'paid') return lastStatus
        } catch {
            // Transient session-status failures are retryable. We do not
            // attribute or publish a payment without Stripe confirmation.
        }
        if (attempt + 1 < attempts) {
            await new Promise<void>((resolve) => setTimeout(resolve, pauseMs))
        }
    }

    return lastStatus
}
