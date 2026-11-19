import { PrismaService } from '../prisma/prisma.service';
import { hasDealerPermission, resolveDealerActor } from '../dealers/dealer-access';
import { sellerBonusEmailState } from '../admin/seller-bonus-email-state';
import { PLATFORM_KNOWLEDGE } from './mazium-platform-knowledge';

const PRIVATE_TOOLS: Record<string, string> = {
 read_my_account: 'Read authenticated role, dealer bidding permissions and saved Stripe onboarding flag. No bank details.',
 read_my_listings: 'Read 10 recent listings owned by this user or their permitted dealership only.',
 read_my_seller_bonuses: 'Read 10 recent personally owned auction handover and bonus records. A recorded transfer is not bank settlement.',
 read_my_warranty_orders: 'Read 10 recent warranty orders linked to this signed-in customer. Distinguish quotation, payment and policy issuance. Cannot find guest orders by email.',
 read_my_service_jobs: 'Read 10 recent TradeXchange jobs booked by this signed-in customer, with payment and completion states. Does not access assigned provider or dealership jobs.',
};

export const MAZIUM_TOOLS: any[] = [
 { type: 'function', function: { name: 'read_platform_knowledge', description: 'Read verified workflow details. Select all relevant topics, including follow-ups.', strict: true, parameters: { type: 'object', properties: { topics: { type: 'array', items: { type: 'string', enum: PLATFORM_KNOWLEDGE.map(t => t.id) }, maxItems: 12 } }, required: ['topics'], additionalProperties: false } } },
 ...Object.entries(PRIVATE_TOOLS).map(([name, description]) => ({ type: 'function', function: { name, description, strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } } })),
];
export const KNOWLEDGE_INDEX = PLATFORM_KNOWLEDGE.map(t => `${t.id}: ${t.facts.split('. ')[0]}`).join('\n');
export async function runMaziumTool(prisma: PrismaService, userId: string | undefined, name: string, args: Record<string, unknown>) {
 if (name === 'read_platform_knowledge') {
  if (!Array.isArray(args.topics) || args.topics.length > 12) return { error: 'INVALID_TOPICS' };
  return PLATFORM_KNOWLEDGE.filter(t => (args.topics as unknown[]).includes(t.id)).map(t => ({ topic: t.id, facts: t.facts }));
 }
 if (!Object.prototype.hasOwnProperty.call(PRIVATE_TOOLS, name)) return { error: 'UNSUPPORTED_TOOL' };
 if (!args || Object.keys(args).length) return { error: 'INVALID_ARGUMENTS' };
 if (!userId) return { error: 'SIGN_IN_REQUIRED', checked: false };
 const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true, stripeConnectOnboardingComplete: true } });
 if (!user || user.deletedAt) return { error: 'ACCOUNT_UNAVAILABLE', checked: false };
 // Personal purchases must never inherit a dealership owner's identity.
 if (name === 'read_my_warranty_orders') return {
  checkedAt: new Date().toISOString(),
  scope: '10 most recently updated warranty orders linked to this customer ID only. Guest orders and older records are not covered; absence does not prove no purchase.',
  limitation: 'Saved platform records, not a live insurer check. QUOTED is not payment; PAID is not policy issuance; cover dates and issued status must be checked separately.',
  orders: await prisma.warrantyOrder.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 10,
   select: { id: true, status: true, totalPence: true, currency: true, paidAt: true, issuedAt: true, coverStart: true, coverEnd: true, expiresAt: true, updatedAt: true } }),
 };
 if (name === 'read_my_service_jobs') return {
  checkedAt: new Date().toISOString(),
  scope: '10 most recently updated TradeXchange jobs booked by this customer ID only. Not assigned provider jobs or other dealership members’ jobs; absence does not prove no job exists.',
  limitation: 'Saved platform status only. Payment, provider completion, customer confirmation and release are separate; release does not verify bank settlement.',
  jobs: await prisma.serviceJob.findMany({ where: { customerId: userId }, orderBy: { updatedAt: 'desc' }, take: 10,
   select: { id: true, serviceType: true, isRecovery: true, status: true, requestedFor: true, acceptedAt: true, startedAt: true, completedAt: true, confirmedAt: true, cancelledAt: true, updatedAt: true,
    payment: { select: { status: true, grossPence: true, paidAt: true, releasedAt: true, refundedAt: true } } } }),
 };
 const actor = user.role === 'DEALER' ? await resolveDealerActor(prisma, userId) : null;
 if (name === 'read_my_account') return { checkedAt: new Date().toISOString(), role: user.role, dealerStaffRole: actor?.role ?? null, dealerVerified: actor?.isVerified ?? false, canViewTrade: !!actor?.isVerified && hasDealerPermission(actor, 'VIEW_TRADE'), canPlaceBid: !!actor?.isVerified && hasDealerPermission(actor, 'PLACE_BID'), stripeOnboardingRecordedComplete: user.stripeConnectOnboardingComplete, limitation: 'Bidding also depends on auction state. Stripe flag is not a live balance or bank settlement check.' };
 if (actor && !hasDealerPermission(actor, 'VIEW_INVENTORY')) return { error: 'PERMISSION_REQUIRED', checked: false };
 const ownerId = actor?.ownerUserId ?? userId;
 if (name === 'read_my_listings') return { checkedAt: new Date().toISOString(), scope: '10 most recently updated owned listings; absence is not proof a listing never existed', listings: await prisma.listing.findMany({ where: { sellerId: ownerId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, make: true, model: true, year: true, type: true, status: true, updatedAt: true } }) };
 // Bonus records belong to this seller personally, not dealership staff.
 const rows = await prisma.auction.findMany({ where: { deletedAt: null, listing: { sellerId: userId, deletedAt: null } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, status: true, buyerFeePaid: true, sellerFundsConfirmedAt: true, handoverSubmittedAt: true, handoverRejectedAt: true, sellerBonusReleased: true, manualPayoutConfirmedAt: true, stripePayoutTransferId: true, listing: { select: { make: true, model: true, year: true } } } });
 return { checkedAt: new Date().toISOString(), scope: '10 most recently updated owned auctions', auctions: rows.map(({ stripePayoutTransferId, manualPayoutConfirmedAt, ...r }) => ({ ...r, payoutState: r.sellerBonusReleased ? sellerBonusEmailState({ ...r, stripePayoutTransferId, manualPayoutConfirmedAt }) : 'NOT_APPROVED', bankSettlementVerified: false })) };
}
export function boundedConversation(messages: { role: 'user' | 'assistant'; content: string }[]) {
 let remaining = 24000;
 const result: typeof messages = [];
 for (const m of messages.slice(-40).reverse()) {
  if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') continue;
  const content = m.content.slice(0, Math.min(4000, remaining));
  if (!content) break;
  result.unshift({ role: m.role, content }); remaining -= content.length;
 }
 return result;
}

/** Redact credentials/contact details before any external AI call. */
export function redactMaziumText(text: string): string {
 return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email withheld]')
  .replace(/(?:\+44\s?7|\b07)\d(?:[\s-]?\d){8}\b/g, '[phone withheld]')
  .replace(/\b(?:my password is|password[:=]|cvv|sort code|account number|passport number|one.time code|otp)\b[^\n]*/gi, '[credentials withheld]');
}
