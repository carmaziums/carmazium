import { toCsv } from "./csvExport"

type ExportTransaction = {
    id: string
    createdAt?: string
    listing?: { vrm?: string | null } | null
    type: string
    status: string
    amount: string | number
    stripePaymentId?: string | null
}

/** Export only ledger fields; never include customer contact or report data. */
export function transactionCsv(transactions: ExportTransaction[]): string {
    return toCsv([
        ["Transaction ID", "Date UTC", "Registration", "Type", "Status", "Amount GBP", "Stripe reference"],
        ...transactions.map(t => [t.id, t.createdAt, t.listing?.vrm, t.type, t.status, t.amount, t.stripePaymentId]),
    ])
}
