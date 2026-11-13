export type WarrantyPrice = { totalPence: number; currency: string; vatIncluded: boolean; lines: { code: string; label: string; amountPence: number }[] }
export type WarrantyOrder = {
    id: string; status: string; statusLabel: string; totalPence: number; price: WarrantyPrice;
    customer: Record<string, string>; vehicle: Record<string, string | number | boolean>;
    selection: { vehicleCategory: string; repairLimit: number; labourRate: number; extras: string[] };
    expiresAt: string; checkoutExpiresAt?: string; createdAt: string; paidAt?: string; issuedAt?: string;
    warrantyReference?: string; coverStart?: string; coverEnd?: string;
    stripeCheckoutSessionId?: string; stripePaymentIntentId?: string; paymentReviewReason?: string;
    messages?: { kind: string; sentAt?: string; attempts: number }[];
}
export const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
export const warrantyInput = 'mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)]'
export const warrantyPanel = 'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7'
export const warrantyHeaders = { 'X-CSRF-Token': 'warranty-order' }
export function orderToken(id: string) { try { return localStorage.getItem(`warranty-order-${id}`) || '' } catch { return '' } }
