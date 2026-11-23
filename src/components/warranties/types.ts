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

export function warrantyEstimate(values: Record<string,string>, extras: string[]): number | null {
    if (!["CAR","SUV"].includes(values.vehicleCategory) || !["1000","2000"].includes(values.repairLimit) || !["75","100","150","200"].includes(values.labourRate)) return null
    const base = values.vehicleCategory === "SUV" ? 44500 : 36000
    const labour = ({ "75": 0, "100": 0.5, "150": 0.75, "200": 1 } as Record<string,number>)[values.labourRate]
    const additions: Record<string,number> = { AIRBAGS:2000, DRIVER_ASSISTANCE:2000, EMISSIONS:2000, MULTIMEDIA:8000 }
    return base - (values.repairLimit === "1000" ? 3000 : 0) + base * labour + [...new Set(extras)].reduce((total,code)=>total+(additions[code] ?? 0),0)
}
