import { PrismaService } from '../prisma/prisma.service';
import { hasDealerPermission, resolveDealerActor } from '../dealers/dealer-access';
import { sellerBonusEmailState } from '../admin/seller-bonus-email-state';
import { PLATFORM_KNOWLEDGE } from './mazium-platform-knowledge';

export const MAZIUM_TOOLS: any[] = [
 { type: 'function', function: { name: 'read_platform_knowledge', description: 'Read verified workflow details. Select all relevant topics, including follow-ups.', strict: true, parameters: { type: 'object', properties: { topics: { type: 'array', items: { type: 'string', enum: PLATFORM_KNOWLEDGE.map(t => t.id) }, maxItems: 12 } }, required: ['topics'], additionalProperties: false } } },
 ...['read_my_account', 'read_my_listings', 'read_my_seller_bonuses'].map(name => ({ type: 'function', function: { name, description: ({ read_my_account: 'Read authenticated role, dealer bidding permissions and saved Stripe onboarding flag. No bank details.', read_my_listings: 'Read 10 recent listings owned by this user or their permitted dealership only.', read_my_seller_bonuses: 'Read 10 recent owned auction handover and bonus records. A recorded transfer is not bank settlement.' })[name], strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } } })),
];
export const KNOWLEDGE_INDEX = PLATFORM_KNOWLEDGE.map(t => `${t.id}: ${t.facts.split('. ')[0]}`).join('\n');
export async function runMaziumTool(prisma: PrismaService, userId: string | undefined, name: string, args: Record<string, unknown>) {
 if (name === 'read_platform_knowledge') {
  if (!Array.isArray(args.topics) || args.topics.length > 12) return { error: 'INVALID_TOPICS' };
  return PLATFORM_KNOWLEDGE.filter(t => (args.topics as unknown[]).includes(t.id)).map(t => ({ topic: t.id, facts: t.facts }));
 }
 if (!['read_my_account', 'read_my_listings', 'read_my_seller_bonuses'].includes(name)) return { error: 'UNSUPPORTED_TOOL' };
 if (!args || Object.keys(args).length) return { error: 'INVALID_ARGUMENTS' };
 if (!userId) return { error: 'SIGN_IN_REQUIRED', checked: false };
 const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true, stripeConnectOnboardingComplete: true } });
 if (!user || user.deletedAt) return { error: 'ACCOUNT_UNAVAILABLE', checked: false };
 const actor = user.role === 'DEALER' ? await resolveDealerActor(prisma, userId) : null;
 if (name === 'read_my_account') return { checkedAt: new Date().toISOString(), role: user.role, dealerVerified: actor?.isVerified ?? false, canViewTrade: !!actor?.isVerified && hasDealerPermission(actor, 'VIEW_TRADE'), canPlaceBid: !!actor?.isVerified && hasDealerPermission(actor, 'PLACE_BID'), stripeOnboardingRecordedComplete: user.stripeConnectOnboardingComplete, limitation: 'Bidding also depends on auction state. Stripe flag is not a live balance or bank settlement check.' };
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
