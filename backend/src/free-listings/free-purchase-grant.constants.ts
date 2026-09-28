export const ADMIN_FREE_PURCHASE_TRANSACTION_PREFIX =
    'Admin-granted free auction purchase (';

export function isAdminGrantedFreePurchaseTransaction(
    transaction: { amount?: unknown; description?: string | null } | null | undefined,
): boolean {
    return Boolean(
        transaction
        && Number(transaction.amount) === 0
        && typeof transaction.description === 'string'
        && transaction.description.startsWith(ADMIN_FREE_PURCHASE_TRANSACTION_PREFIX),
    );
}
