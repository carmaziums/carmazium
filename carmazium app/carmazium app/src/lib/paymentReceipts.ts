export interface PaymentReceipt {
  id: string; type: string; amount: number | string; status: string; createdAt: string;
  description?: string | null; stripePaymentId?: string | null; synthetic?: boolean;
  listing?: {title?:string; images?:string[]} | null;
}
export interface ReceiptKyc {stripeChargedAt?:string | null; stripePaymentIntentId?:string | null}
/** Preserve older KYC payments without duplicating a reconciled ledger entry. */
export function mergePaymentReceipts(transactions: PaymentReceipt[], kyc?: ReceiptKyc | null): PaymentReceipt[] {
  if (!Array.isArray(transactions)) throw Error('Payment history unavailable');
  const receipts = [...transactions];
  const canonical = receipts.some(r => r.type === 'KYC_VERIFICATION' && (!kyc?.stripePaymentIntentId || r.stripePaymentId === kyc.stripePaymentIntentId));
  if (kyc?.stripeChargedAt && !canonical) receipts.push({id:kyc.stripePaymentIntentId || 'kyc-fee',type:'KYC_VERIFICATION',amount:1,status:'COMPLETED',createdAt:kyc.stripeChargedAt,description:'One-time dealer identity verification fee',stripePaymentId:kyc.stripePaymentIntentId,synthetic:true});
  return receipts.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export function paymentReceiptPath(receipt: PaymentReceipt): string {
  if (receipt.synthetic) throw Error('Receipt will be available after the payment ledger is reconciled.');
  return `/transactions/${encodeURIComponent(receipt.id)}/receipt.pdf`;
}
