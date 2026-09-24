#!/usr/bin/env node

/**
 * CarMazium one-product parity guard.
 *
 * This intentionally checks the highest-risk cross-client business constants
 * and verifies that every feature marked "required" in product-parity.json
 * still has both a web and mobile implementation file.
 *
 * It is not a substitute for end-to-end tests; it is the fast CI tripwire that
 * prevents silent web/mobile drift.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const fail = (message) => {
  console.error(`PARITY ERROR: ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`PARITY OK: ${message}`);
const warn = (message) => console.warn(`PARITY GAP: ${message}`);

function objectBlock(source, key) {
  const keyPattern = new RegExp(`\\b${key}\\s*(?::|=)`);
  const match = keyPattern.exec(source);
  const keyIndex = match?.index ?? -1;
  if (keyIndex < 0) throw new Error(`Could not find object key "${key}"`);
  const open = source.indexOf('{', keyIndex);
  if (open < 0) throw new Error(`Could not find opening brace for "${key}"`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`Could not find closing brace for "${key}"`);
}

function numberProp(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!m) throw new Error(`Could not find numeric property "${key}"`);
  return Number(m[1]);
}

function boolProp(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  if (!m) throw new Error(`Could not find boolean property "${key}"`);
  return m[1] === 'true';
}

function numberConst(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!m) throw new Error(`Could not find numeric constant "${key}"`);
  return Number(m[1]);
}

function same(label, values) {
  const entries = Object.entries(values);
  const first = entries[0]?.[1];
  const mismatch = entries.find(([, value]) => value !== first);
  if (mismatch) {
    fail(`${label} differs: ${entries.map(([name, value]) => `${name}=${value}`).join(', ')}`);
  } else {
    ok(`${label} = ${first}`);
  }
}

const manifest = JSON.parse(read('product-parity.json'));
for (const feature of manifest.features) {
  const webMissing = (feature.web || []).filter((p) => !exists(p));
  const mobileMissing = (feature.mobile || []).filter((p) => !exists(p));

  if (feature.status === 'required') {
    if (!feature.web?.length || !feature.mobile?.length) {
      fail(`${feature.id} is required but does not declare both web and mobile surfaces`);
      continue;
    }
    if (webMissing.length || mobileMissing.length) {
      fail(`${feature.id} missing files: ${[...webMissing, ...mobileMissing].join(', ')}`);
    } else {
      ok(`${feature.id} has web + mobile surfaces`);
    }
  } else if (feature.status === 'gap') {
    warn(`${feature.id} is still missing parity`);
  }
}

// Authentication / account-role contract. The backend enum contains privileged
// roles, but only the four self-service roles may ever be selected by a public
// registration, Supabase metadata, or the self-elevation endpoint.
const accountRoles = read('backend/src/core/account-roles.ts');
const registerDto = read('backend/src/auth/dto/register.dto.ts');
const authService = read('backend/src/auth/auth.service.ts');
const mobileAuthStore = read('carmazium app/carmazium app/src/store/authStore.ts');
const mobileSignup = read('carmazium app/carmazium app/src/screens/auth/SignupScreen.tsx');
const mobileApp = read('carmazium app/carmazium app/App.tsx');

const selfServiceMatch = accountRoles.match(/SELF_SERVICE_USER_ROLES[^=]*=\s*\[([\s\S]*?)\];/);
if (!selfServiceMatch) {
  fail('Could not read canonical SELF_SERVICE_USER_ROLES');
} else {
  const roleBody = selfServiceMatch[1];
  for (const role of ['BUYER', 'SELLER', 'DEALER', 'CONTRACTOR']) {
    if (!roleBody.includes(`UserRole.${role}`)) {
      fail(`Self-service role contract is missing ${role}`);
    }
  }
  for (const role of ['ADMIN', 'FINANCE_PARTNER', 'INSURANCE_PARTNER']) {
    if (roleBody.includes(`UserRole.${role}`)) {
      fail(`Privileged role ${role} must never be self-service`);
    }
  }
  ok('Self-service account roles exclude all privileged roles');
}

if (!registerDto.includes('IsIn([...SELF_SERVICE_USER_ROLES])')) {
  fail('Direct registration is not constrained by SELF_SERVICE_USER_ROLES');
} else {
  ok('Direct registration uses the canonical self-service role allowlist');
}

if (!authService.includes('isSelfServiceUserRole(meta.role)')) {
  fail('Supabase role metadata is not constrained by the self-service role allowlist');
} else {
  ok('Supabase role metadata cannot self-grant privileged roles');
}

const mobileAccountRoleMatch = mobileAuthStore.match(/export type AccountRole\s*=([\s\S]*?);/);
if (!mobileAccountRoleMatch) {
  fail('Could not read the mobile AccountRole union');
} else {
  const mobileRoles = mobileAccountRoleMatch[1];
  for (const role of [
    'buyer',
    'seller',
    'dealer',
    'contractor',
    'finance_partner',
    'insurance_partner',
    'admin',
  ]) {
    if (!mobileRoles.includes(`'${role}'`)) {
      fail(`Mobile AccountRole is missing backend role mapping for ${role}`);
    }
  }
  ok('Mobile recognizes every backend account role without buyer fallback');
}

if (mobileAuthStore.includes('PENDING_SIGNUP_ROLE_KEY')) {
  fail('Mobile OAuth signup role must not be persisted on-device');
} else if (
  !mobileSignup.includes('auth/callback?role=${encodeURIComponent(role)}') ||
  !mobileApp.includes('reinitializeAuth(callbackRole)')
) {
  fail('Mobile OAuth signup account type is not bound to the callback URL');
} else {
  ok('Mobile OAuth signup account type is callback-scoped and non-persistent');
}

// Seller journey parity: both clients must use the same backend channel-switch
// and review/payment lifecycle rather than creating client-specific shortcuts.
// Keep this section as a CI tripwire whenever seller flows change on either client.
const webListingWizard = read('src/components/listing/ListingWizard.tsx');
const mobileSellFlow = read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx');
const mobileListingsScreen = read('carmazium app/carmazium app/src/screens/seller/SellerListingsScreen.tsx');
const mobileAuctionsScreen = read('carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx');
const mobileListingsApi = read('carmazium app/carmazium app/src/lib/listingsApi.ts');
const backendListings = read('backend/src/listings/listings.service.ts');

for (const [surface, source] of [
  ['web seller wizard', webListingWizard],
  ['mobile seller flow', mobileSellFlow],
]) {
  if (
    !source.includes('getRetailConversionCandidate') ||
    !source.includes('convertAuctionToRetail')
  ) {
    fail(`${surface} must use the shared auction → Retail conversion contract`);
  }
}
if (
  !mobileListingsApi.includes('/retail-conversion-candidate?vrm=') ||
  !mobileListingsApi.includes('/convert-to-retail')
) {
  fail('Mobile listing API is missing the shared auction → Retail endpoints');
} else {
  ok('Web and mobile use the same auction → Retail conversion contract');
}

if (
  !mobileListingsScreen.includes('pendingReview') ||
  !mobileListingsScreen.includes("status: 'PENDING_REVIEW'")
) {
  fail('Mobile My Listings must recognise PENDING_REVIEW as a successful seller submission');
} else {
  ok('Mobile seller publish flow recognises admin-review state');
}

if (
  mobileAuctionsScreen.includes('The vehicle can now be found and bought without bidding') ||
  !mobileAuctionsScreen.includes('Retail listing submitted for review')
) {
  fail('Mobile dual-channel Retail flow must not claim a paid draft is already public');
} else {
  ok('Mobile dual-channel Retail flow respects the review gate');
}

if (!backendListings.includes('stripe.paymentIntents.retrieve(tx.stripePaymentId)')) {
  fail('Backend publish reconciliation must support native PaymentIntent listing fees');
} else {
  ok('Backend publish reconciliation supports web Checkout Sessions and native PaymentIntents');
}

if (
  !mobileSellFlow.includes("badgeTier === 'STANDARD' || badgeTier === 'PREMIUM'") ||
  !mobileSellFlow.includes('HPI Check Included')
) {
  fail('Mobile must not offer an extra HPI charge on Standard/Premium packages');
} else {
  ok('Mobile HPI add-on respects Standard/Premium HPI inclusion');
}

if (
  !webListingWizard.includes("formData.vrm && (isAuction || formData.badgeTier === 'BASIC')") ||
  !webListingWizard.includes('Optional for both Auction and Retail listings')
) {
  fail('Web seller wizard must expose the optional HPI add-on for Auction as well as Basic Retail listings');
} else {
  ok('Web HPI add-on is available for both Auction and Basic Retail listings');
}

if (
  !webListingWizard.includes('Start Fresh') ||
  !mobileSellFlow.includes('START FRESH')
) {
  fail('Seller draft reset is not available on both web and mobile');
} else {
  ok('Seller draft reset is available on both clients');
}

// Buyer journey parity: native UX may differ from the browser, but buyer
// intent and payment truth must survive the platform boundary unchanged.
const webVehicleDetail = read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx');
const mobileVehicleDetail = read('carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx');
const hpiController = read('backend/src/hpi/hpi.controller.ts');
const hpiService = read('backend/src/hpi/hpi.service.ts');
const webHpiReportModal = read('src/components/hpi/HpiReportModal.tsx');
const mobilePaymentsApi = read('carmazium app/carmazium app/src/lib/paymentsApi.ts');
const mobilePurchaseFlow = read('carmazium app/carmazium app/src/screens/main/PurchaseFlowScreen.tsx');
const mobileAuctionComplete = read('carmazium app/carmazium app/src/screens/main/AuctionCompleteScreen.tsx');
const mobilePartnerDashboard = read('carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx');
const mobileProviderCapabilities = read('carmazium app/carmazium app/src/screens/main/ProviderCapabilitiesScreen.tsx');
const mobileProviderVerification = read('carmazium app/carmazium app/src/screens/main/ProviderVerificationScreen.tsx');
const mobileProviderMatching = read('carmazium app/carmazium app/src/screens/main/ProviderMatchingScreen.tsx');
const mobileProviderJobs = read('carmazium app/carmazium app/src/screens/main/ProviderJobsScreen.tsx');
const mobileProviderJobDetail = read('carmazium app/carmazium app/src/screens/main/ProviderJobDetailScreen.tsx');
const mobileProviderLeads = read('carmazium app/carmazium app/src/screens/main/ProviderLeadsScreen.tsx');
const mobileProviderLeadDetail = read('carmazium app/carmazium app/src/screens/main/ProviderLeadDetailScreen.tsx');
const mobileProviderMessages = read('carmazium app/carmazium app/src/screens/main/ProviderMessagesScreen.tsx');
const mobileServicesApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const mobileChatApi = read('carmazium app/carmazium app/src/lib/chatApi.ts');
const mobileMainNavigator = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const mobileGlobalDrawer = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx');
const mobileBuyerDashboard = read('carmazium app/carmazium app/src/screens/buyer/BuyerDashboardScreen.tsx');
const mobileBuyerBids = read('carmazium app/carmazium app/src/screens/buyer/BuyerBidsScreen.tsx');
const backendBidsService = read('backend/src/bids/bids.service.ts');
const paymentsController = read('backend/src/payments/payments.controller.ts');
const buyerPaymentsService = read('backend/src/payments/payments.service.ts');
const adminServiceForPayouts = read('backend/src/admin/admin.service.ts');
const buyerAuctionsService = read('backend/src/auctions/auctions.service.ts');
const buyerServicesService = read('backend/src/services/services.service.ts');
const webAuctionApi = read('src/lib/auctionApi.ts');
const mobileAuctionApi = read('carmazium app/carmazium app/src/lib/auctionApi.ts');
const mobileAuctionDetailForInspection = read('carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx');
const mobileCustomerServiceJobs = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobsScreen.tsx');
const mobileCustomerServiceJobDetail = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
const mobileServicesScreen = read('carmazium app/carmazium app/src/screens/main/ServicesScreen.tsx');
const mobileLinkingConfig = read('carmazium app/carmazium app/src/navigation/linking.ts');
const mobileVehicleDeepLink = read('carmazium app/carmazium app/src/screens/vehicle/VehicleDeepLinkScreen.tsx');
const mobileAuctionDeepLink = read('carmazium app/carmazium app/src/screens/vehicle/AuctionDeepLinkScreen.tsx');
const mobileAppConfig = read('carmazium app/carmazium app/app.json');

if (
  !webVehicleDetail.includes('message || undefined') ||
  !mobileVehicleDetail.includes('message: offerMessage.trim() || undefined') ||
  !mobileVehicleDetail.includes('maxLength={500}')
) {
  fail('Buyer offer message must be preserved on web and mobile create/amend flows');
} else {
  ok('Buyer offers preserve the optional seller message across clients');
}

if (
  !mobilePaymentsApi.includes('/payments/reconcile-auction-fee-intent') ||
  !paymentsController.includes("@Post('reconcile-auction-fee-intent')") ||
  !buyerPaymentsService.includes('async reconcileAuctionFeeIntent(') ||
  !buyerPaymentsService.includes('stripe.paymentIntents.retrieve(transaction.stripePaymentId)')
) {
  fail('Native auction buyer-fee payment is missing authoritative PaymentIntent reconciliation');
} else {
  ok('Native auction buyer fee reconciles against Stripe before auction unlock');
}

// Block 8 — hosted Stripe Checkout recovery must not become a session-ID
// bearer capability. Authenticated callers are checked against the transaction
// owner, with only explicit dealership permissions allowed to delegate recovery.
if (
  !paymentsController.includes("getSessionStatus(sessionId, user.id)") ||
  !paymentsController.includes("applyAuctionFee(sessionId, user.id)") ||
  !paymentsController.includes("applyKycFee(sessionId, user.id)") ||
  !paymentsController.includes("applyHpiFee(sessionId, user.id)") ||
  !paymentsController.includes("applyHpiEmailFee(sessionId, user.id)") ||
  !buyerPaymentsService.includes('async assertPaymentActorAccess(') ||
  !buyerPaymentsService.includes('async assertCheckoutSessionAccess(') ||
  !buyerPaymentsService.includes("metadata.type === 'COMMISSION'") ||
  !buyerPaymentsService.includes("metadata.type === 'LISTING_FEE'") ||
  !buyerPaymentsService.includes("metadata.type === 'KYC_VERIFICATION'") ||
  !buyerPaymentsService.includes("metadata.boostId && metadata.sellerId") ||
  !buyerPaymentsService.includes("assertPaymentActorAccess(transaction.userId, userId)")
) {
  fail('Hosted Checkout recovery can drift back to unowned session-ID reconciliation');
} else {
  ok('Hosted Checkout recovery is bound to the authenticated payment/dealership owner');
}

if (
  !backendBidsService.includes('wonAt: true') ||
  !backendBidsService.includes('buyerFeePaid: true') ||
  !mobileBuyerBids.includes('paymentDeadline: auction?.wonAt') ||
  !mobileBuyerBids.includes('!bid.buyerFeePaid ?') ||
  !mobileBuyerBids.includes('CHAT WITH SELLER')
) {
  fail('Won-auction mobile state must use authoritative fee-paid and win-time fields');
} else {
  ok('Won-auction payment deadline and contact actions use authoritative backend state');
}

if (
  !buyerPaymentsService.includes("transaction.stripePaymentId.startsWith('pi_')") ||
  !buyerPaymentsService.includes("payment_intent: paymentIntentId") ||
  !buyerPaymentsService.includes('amount: 10000')
) {
  fail('Auction handover refund path must support both web Checkout and native PaymentIntent fees');
} else {
  ok('Auction handover refunds support web and native buyer-fee payments');
}

if (
  !buyerPaymentsService.includes('async getPayableAuctionForWinner') ||
  !buyerPaymentsService.includes("'Only the winning dealership can pay the buyer fee'") ||
  !buyerPaymentsService.includes("'The auction buyer fee has already been paid'") ||
  !buyerPaymentsService.includes('winnerId !== buyerId') ||
  !buyerPaymentsService.includes("'PAY_AUCTION_FEE'")
) {
  fail('Auction buyer fee charging must be winner-only and idempotently business-bound');
} else {
  ok('Auction buyer fee charging is restricted to the recorded winning dealership');
}

if (
  !buyerServicesService.includes('InspectionOutcome.FAULTS_FOUND') ||
  !buyerServicesService.includes('createInspectionFromAuction') ||
  !buyerAuctionsService.includes('async refuseAfterInspection(') ||
  !buyerAuctionsService.includes('issueFullRefundForAuctionInspection') ||
  !buyerPaymentsService.includes('12500 - alreadyRefunded') ||
  !buyerPaymentsService.includes('amount: remainingPence') ||
  !webAuctionApi.includes('/refuse-after-inspection') ||
  !mobileAuctionApi.includes('/refuse-after-inspection')
) {
  fail('Auction inspection refusal must remain a verified, full-refund backend contract on both clients');
} else {
  ok('Auction inspection refusal is fault-verified and refunds the full £125 buyer fee');
}


if (
  !mobileVehicleDeepLink.includes('getListingById(slug)') ||
  !mobileVehicleDeepLink.includes("name: 'VehicleDetail'") ||
  !mobileVehicleDeepLink.includes("name: 'Tabs'") ||
  !mobileAuctionDeepLink.includes('getAuction(auctionId)') ||
  !mobileAuctionDeepLink.includes('auctionToListingParam(auction)') ||
  !mobileAuctionDeepLink.includes("name: 'LiveAuctionDetailed'") ||
  !mobileAuctionDeepLink.includes("name: 'Tabs'") ||
  !mobileLinkingConfig.includes("path: 'buy-cars/:slug'") ||
  !mobileLinkingConfig.includes("path: 'auctions/live/:auctionId'") ||
  !mobileAppConfig.includes('"applinks:carmazium.com"') ||
  !mobileAppConfig.includes('"pathPrefix": "/buy-cars"') ||
  !mobileAppConfig.includes('"pathPrefix": "/auctions/live"')
) {
  fail('Native public vehicle/auction links must hydrate safely and preserve a usable back stack');
} else {
  ok('Native public detail links hydrate authoritative data and reset to Tabs → Detail');
}

// Block 9 — cross-role navigation/back-stack certification.
// Drawer targets must always point at registered MainStack screens, and
// dashboard deep links must keep Tabs beneath the linked screen so Back does
// not exit a cold-started app immediately.
const registeredMainScreens = [
  ...mobileMainNavigator.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g),
].map((match) => match[1]);
const drawerStackTargets = [
  ...mobileGlobalDrawer.matchAll(/stackScreen:\s*'([^']+)'/g),
].map((match) => match[1]);
const missingDrawerTargets = [...new Set(drawerStackTargets)]
  .filter((target) => !registeredMainScreens.includes(target));

if (
  missingDrawerTargets.length > 0 ||
  !mobileBuyerDashboard.includes("navigation?.navigate('Tabs', { screen: 'Search' })") ||
  mobileBuyerDashboard.includes("navigation?.navigate('Search')") ||
  !mobileLinkingConfig.includes("initialRouteName: 'Tabs'")
) {
  fail(
    `Native cross-role navigation/back stack drifted${
      missingDrawerTargets.length
        ? `: missing drawer targets ${missingDrawerTargets.join(', ')}`
        : ''
    }`,
  );
} else {
  ok('Native drawer targets are registered and linked dashboard screens preserve Tabs back stack');
}

if (
  !mobileServicesApi.includes('createInspectionFromAuction') ||
  !mobileServicesApi.includes('getMyServiceJobsPage') ||
  !mobileServicesApi.includes('acceptCustomerQuote') ||
  !mobileServicesApi.includes('confirmCustomerServiceJob') ||
  !mobileAuctionDetailForInspection.includes('createInspectionFromAuction') ||
  !mobileAuctionDetailForInspection.includes("navigation.navigate('CustomerServiceJobDetail'") ||
  !mobileCustomerServiceJobs.includes("navigation.navigate('CustomerServiceJobDetail'") ||
  !mobileCustomerServiceJobDetail.includes('refuseAuctionAfterInspection') ||
  !mobileCustomerServiceJobDetail.includes("job.inspectionOutcome === 'FAULTS_FOUND'") ||
  !mobileCustomerServiceJobDetail.includes('REFUSE VEHICLE & REFUND £125') ||
  !mobileCustomerServiceJobDetail.includes('acceptCustomerQuote') ||
  !mobileCustomerServiceJobDetail.includes('getOrCreateServiceJobRoom') ||
  !mobileServicesScreen.includes("navigation.navigate('CustomerServiceJobs')") ||
  !mobileMainNavigator.includes('CustomerServiceJobs') ||
  !mobileMainNavigator.includes('CustomerServiceJobDetail') ||
  !mobileLinkingConfig.includes("CustomerServiceJobs: 'services/jobs'") ||
  !mobileLinkingConfig.includes("path: 'services/jobs/:jobId'")
) {
  fail('Native customer inspection/refusal journey must remain reachable end-to-end');
} else {
  ok('Native customer service jobs make verified auction inspection/refusal reachable');
}

if (
  !mobilePurchaseFlow.includes('setPendingConfirmationId(sheet.transactionId)') ||
  !mobilePurchaseFlow.includes('reconcilePendingAuctionFee(sheet.transactionId)') ||
  !mobilePurchaseFlow.includes('CONFIRM PAYMENT STATUS') ||
  !mobilePurchaseFlow.includes('within 72 hours') ||
  !mobileAuctionComplete.includes('setPendingConfirmationId(sheet.transactionId)') ||
  !mobileAuctionComplete.includes('reconcileAuctionFeeIntent(sheet.transactionId)') ||
  !mobileAuctionComplete.includes('CONFIRM PAYMENT STATUS') ||
  !mobileAuctionComplete.includes('within 72 hours')
) {
  fail('Mobile auction fee UX can drift into duplicate charge or missing deadline guidance');
} else {
  ok('Every mobile auction fee path reuses the same payment and preserves 72-hour guidance');
}

// Block 8 — the £100 auction seller reward must be settled exactly once.
// Approval, Stripe retry and manual fallback share an atomic DB claim; Stripe
// receives one stable idempotency key for the auction.
if (
  !adminServiceForPayouts.includes("claim:seller-bonus:") ||
  !adminServiceForPayouts.includes('sellerPayoutIdempotencyKey') ||
  !adminServiceForPayouts.includes('sellerBonusReleased: false') ||
  !adminServiceForPayouts.includes('stripePayoutTransferId: claimToken') ||
  !adminServiceForPayouts.includes("startsWith: 'claim:seller-bonus:'") ||
  !adminServiceForPayouts.includes('manualPayoutConfirmedAt: null') ||
  !adminServiceForPayouts.includes('Use Retry via Stripe first') ||
  !buyerPaymentsService.includes('idempotencyKey ? { idempotencyKey } : undefined')
) {
  fail('Auction seller bonus payout can drift back to duplicate Stripe/manual settlement');
} else {
  ok('Auction seller bonus payout is atomically claimed and Stripe-idempotent');
}

// Block 8 closeout — HPI access/delivery parity and provider payout safety.
if (
  !hpiController.includes("listing/:listingId/summary") ||
  !hpiController.includes("listing/:listingId/pdf") ||
  !hpiController.includes('getMyEmailRequest(listingId, user.id)') ||
  !hpiService.includes('where: { hpiReportId: report.id, buyerId }') ||
  !hpiService.includes('requestEmailDelivery') ||
  !webHpiReportModal.includes('createHpiEmailCheckout') ||
  !webHpiReportModal.includes('getMyHpiEmailRequest') ||
  !webHpiReportModal.includes('openHpiPdf') ||
  !mobileVehicleDetail.includes("'/payments/hpi-checkout'") ||
  !mobileVehicleDetail.includes('getHpiSummary') ||
  !mobileVehicleDetail.includes('openHpiPdf')
) {
  fail('HPI report access or buyer-specific email entitlement can drift across web/mobile');
} else {
  ok('HPI report access and buyer-specific email entitlements remain server-bound');
}

if (
  !buyerServicesService.includes('assertProviderPayoutReadyForNewWork') ||
  !buyerServicesService.includes('claim:release:') ||
  !buyerServicesService.includes('service-job-release-') ||
  !buyerServicesService.includes('stripeTransferId: claimToken') ||
  !buyerServicesService.includes('ServicePaymentStatus.RELEASED') ||
  !buyerPaymentsService.includes('connectTransferReady')
) {
  fail('TradeXchange provider payout can drift from atomic claim/idempotent transfer safety');
} else {
  ok('TradeXchange provider payout remains readiness-checked, claimed and Stripe-idempotent');
}

// Partner/provider paid-job parity: native must keep the same authoritative
// marketplace, job lifecycle, structured inspection outcome and service-job chat.
if (
  !mobileServicesApi.includes('/services/jobs/feed?') ||
  !mobileServicesApi.includes('/services/jobs/assigned?') ||
  !mobileServicesApi.includes('/services/jobs/${jobId}/quote') ||
  !mobileServicesApi.includes('/services/jobs/${id}/start') ||
  !mobileServicesApi.includes('/services/jobs/${id}/complete') ||
  !mobileProviderJobs.includes("navigation.navigate('ProviderJobDetail'") ||
  !mobileProviderJobDetail.includes("'FAULTS_FOUND'") ||
  !mobileProviderJobDetail.includes('inspectionSummary.trim()') ||
  !mobileProviderJobDetail.includes('getOrCreateServiceJobRoom(job.id)') ||
  !mobileChatApi.includes('/chat/service-jobs/${jobId}')
) {
  fail('Native Partner Jobs must preserve feed/quote/work/inspection/chat parity with web');
} else {
  ok('Native Partner Jobs preserve provider lifecycle and service-job chat parity');
}

// Partner/provider Finance & Warranty lead parity: native must keep the
// authoritative matched inbox/detail contract and structured provider response.
if (
  !mobileServicesApi.includes('/services/leads/inbox?') ||
  !mobileServicesApi.includes('/services/leads/inbox/${id}') ||
  !mobileServicesApi.includes('/services/leads/${id}/respond') ||
  !mobileProviderLeads.includes("navigation.navigate('ProviderLeadDetail'") ||
  !mobileProviderLeadDetail.includes("lead.serviceType === 'FINANCE'") ||
  !mobileProviderLeadDetail.includes('representativeApr') ||
  !mobileProviderLeadDetail.includes('respondToProviderLead(lead.id')
) {
  fail('Native Partner Leads must preserve Finance/Warranty inbox, detail and response parity');
} else {
  ok('Native Partner Leads preserve matched enquiry and provider response parity');
}

// Partner/provider Messages parity: native reuses the shared chat system, but
// must understand SERVICE_JOB room metadata and expose a provider-focused
// service-job conversation workspace that opens the normal ChatScreen.
if (
  !mobileChatApi.includes("context?: 'SUPPORT' | 'RETAIL' | 'AUCTION' | 'DISPUTE' | 'SERVICE_JOB' | 'LEGACY'") ||
  !mobileChatApi.includes('serviceJob?: ChatServiceJob | null') ||
  !mobileProviderMessages.includes("room.context === 'SERVICE_JOB'") ||
  !mobileProviderMessages.includes("navigation.navigate('ChatScreen'") ||
  !mobileProviderMessages.includes('room.serviceJob?.title') ||
  !mobileMainNavigator.includes('ProviderMessages') ||
  !mobilePartnerDashboard.includes("navigation.navigate('ProviderMessages')")
) {
  fail('Native provider Messages can drift from shared SERVICE_JOB chat context');
} else {
  ok('Native provider Messages reuse shared service-job chat rooms and ChatScreen');
}

// Dealer business identity / RBAC: staff must act under one dealership identity
// and permissions must be enforced server-side, not just hidden in navigation.
const dealerAccess = read('backend/src/dealers/dealer-access.ts');
const dealerService = read('backend/src/dealers/dealers.service.ts');
const dealerController = read('backend/src/dealers/dealers.controller.ts');
const dealerBids = read('backend/src/bids/bids.service.ts');
const dealerListings = read('backend/src/listings/listings.service.ts');
const dealerOffers = read('backend/src/offers/offers.service.ts');
const dealerDashboard = read('backend/src/dashboard/dashboard.service.ts');

if (
  !dealerAccess.includes("'PLACE_BID'") ||
  !dealerAccess.includes("'PAY_AUCTION_FEE'") ||
  !dealerAccess.includes("'PAY_LISTING_FEE'") ||
  !dealerAccess.includes("'VIEW_INVENTORY'") ||
  !dealerAccess.includes("'MANAGE_INVENTORY'") ||
  !dealerAccess.includes("'MANAGE_TEAM'") ||
  !dealerAccess.includes("'MANAGE_KYC'") ||
  !dealerAccess.includes('ownerUserId: membership.dealerProfile.userId')
) {
  fail('Dealer staff RBAC or canonical dealership identity contract is missing');
} else {
  ok('Dealer staff permissions and canonical dealership identity are defined centrally');
}

if (
  !dealerController.includes("@Get('access')") ||
  !dealerService.includes("assertDealerPermission(actor, 'MANAGE_TEAM')") ||
  !dealerService.includes('Only the dealership owner can manage business verification.') ||
  !dealerService.includes("assertDealerPermission(actor, 'VIEW_PURCHASES')") ||
  !dealerDashboard.includes("assertDealerPermission(actor, 'VIEW_ANALYTICS')")
) {
  fail('Dealer dashboard/team/KYC/purchase routes are not enforcing the central business-access contract');
} else {
  ok('Dealer dashboard, team, KYC and purchases use the central business-access contract');
}

if (
  !dealerBids.includes("assertDealerPermission(") ||
  !dealerBids.includes("'PLACE_BID'") ||
  !dealerBids.includes('bidderId: businessBidderId') ||
  !dealerListings.includes("'MANAGE_INVENTORY'") ||
  !dealerListings.includes("'VIEW_INVENTORY'") ||
  !dealerOffers.includes("'MANAGE_OFFERS'") ||
  !buyerPaymentsService.includes("'PAY_AUCTION_FEE'") ||
  !buyerPaymentsService.includes("'PAY_LISTING_FEE'") ||
  !buyerPaymentsService.includes('userId: transactionUserId')
) {
  fail('Dealer staff actions can drift back to personal identities or unguarded role access');
} else {
  ok('Dealer bidding, inventory, offers and fee payments stay dealership-scoped');
}

// Dealer UI permissions must consume the same backend /dealers/access contract.
// This guards against a future client silently reverting to role-name guesses
// or exposing mutation controls to read-only finance staff.
const webDealerAccess = read('src/lib/dealerAccess.ts');
const webDealerAccessContext = read('src/context/DealerAccessContext.tsx');
const webDealerGate = read('src/components/dealer/DealerPermissionGate.tsx');
const webDealerLayout = read('src/app/dashboard/dealer/layout.tsx');
const webDealerRoutes = read('src/config/dealerRouteConfig.ts');
const webDealerInventory = read('src/app/dashboard/dealer/inventory/page.tsx');
const mobileDealerAccess = read('carmazium app/carmazium app/src/lib/dealerAccessApi.ts');
const mobileDealerHook = read('carmazium app/carmazium app/src/hooks/useDealerAccess.ts');
const mobileDealerGate = read('carmazium app/carmazium app/src/components/DealerGate.tsx');
const mobileDealerNavigator = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const mobileDealerDrawer = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx');
const mobileDealerInventory = read('carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx');
const mobileDealerCustomers = read('carmazium app/carmazium app/src/screens/main/DealerLeadsScreen.tsx');
const mobileDealerOffers = read('carmazium app/carmazium app/src/screens/main/DealerOffersScreen.tsx');
const webDealerLiveAuction = read('src/app/auctions/live/[id]/page.tsx');
const webDealerWonAuctions = read('src/app/dashboard/dealer/auctions/won/page.tsx');
const mobileDealerLiveAuction = read('carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx');

if (
  !webDealerAccess.includes("('/dealers/access')") ||
  !webDealerAccessContext.includes('hasPermission') ||
  !webDealerGate.includes('DealerPermissionGate') ||
  !webDealerLayout.includes('DealerRoutePermissionBoundary') ||
  !webDealerLayout.includes('access?.isVerified === true') ||
  !webDealerRoutes.includes('requiredPermission?: DealerPermission') ||
  !webDealerRoutes.includes('requiredPermission: "MANAGE_TEAM"') ||
  !webDealerInventory.includes("hasPermission('MANAGE_INVENTORY')")
) {
  fail('Web dealer UI is not bound to the backend dealership permission contract');
} else {
  ok('Web dealer routes, navigation and inventory controls consume dealership permissions');
}

if (
  !mobileDealerAccess.includes("('/dealers/access')") ||
  !mobileDealerHook.includes('hasPermission') ||
  !mobileDealerGate.includes('requiredPermission?: DealerPermission') ||
  !mobileDealerGate.includes('access?.isVerified === true') ||
  !mobileDealerNavigator.includes("withDealerGate(DealerTeamScreen, 'MANAGE_TEAM')") ||
  !mobileDealerNavigator.includes("withDealerGate(DealerKYCScreen, 'MANAGE_KYC', true)") ||
  !mobileDealerDrawer.includes('visibleDealerItems') ||
  !mobileDealerDrawer.includes("requiredPermission: 'MANAGE_OFFERS'") ||
  !mobileDealerInventory.includes("hasPermission('MANAGE_INVENTORY')")
) {
  fail('Native dealer UI is not bound to the backend dealership permission contract');
} else {
  ok('Native dealer routes, drawer and inventory controls consume dealership permissions');
}

// Block 9 — loading / empty / error / offline state consistency.
// Native already has app-wide network monitoring and shared state primitives;
// web must keep equivalent global offline feedback plus retryable async states
// on the highest-traffic cross-role dashboards.
const webRootLayoutForStates = read('src/app/layout.tsx');
const webAsyncStates = read('src/components/ui/AsyncState.tsx');
const webOfflineBanner = read('src/components/layout/OfflineBanner.tsx');
const webDealerInventoryStates = read('src/app/dashboard/dealer/inventory/page.tsx');
const webDealerCustomersStates = read('src/app/dashboard/dealer/crm/page.tsx');
const webDealerOffersStates = read('src/app/dashboard/dealer/offers/page.tsx');
const webUnifiedDashboardStates = read('src/app/dashboard/user/page.tsx');
const webProviderJobsStates = read('src/app/dashboard/service/jobs/page.tsx');
const webProviderLeadsStates = read('src/app/dashboard/service/leads/page.tsx');
const mobileOfflineBanner = read('carmazium app/carmazium app/src/components/OfflineBanner.tsx');
const mobileEmptyState = read('carmazium app/carmazium app/src/components/ui/EmptyState.tsx');
const mobileErrorBanner = read('carmazium app/carmazium app/src/components/ui/ErrorBanner.tsx');

if (
  !webRootLayoutForStates.includes('<OfflineBanner />') ||
  !webOfflineBanner.includes('window.addEventListener("online"') ||
  !webOfflineBanner.includes('window.addEventListener("offline"') ||
  !webOfflineBanner.includes('aria-live="polite"') ||
  !mobileApp.includes('<OfflineBanner />') ||
  !mobileOfflineBanner.includes('subscribeToConnectivity')
) {
  fail('Web/mobile global offline feedback drifted');
} else {
  ok('Web and native clients keep app-wide offline feedback');
}

if (
  !webAsyncStates.includes('export function LoadingState') ||
  !webAsyncStates.includes('export function ErrorState') ||
  !webAsyncStates.includes('export function EmptyState') ||
  !webAsyncStates.includes('role="alert"') ||
  !webAsyncStates.includes('aria-live="assertive"') ||
  !mobileEmptyState.includes('export const EmptyState') ||
  !mobileErrorBanner.includes('export const ErrorBanner')
) {
  fail('Shared async-state primitives are missing or inaccessible on one client');
} else {
  ok('Web and native clients keep shared loading/empty/error state primitives');
}

for (const [surface, source] of [
  ['dealer inventory', webDealerInventoryStates],
  ['dealer customers', webDealerCustomersStates],
  ['dealer offers', webDealerOffersStates],
  ['unified buyer/seller dashboard', webUnifiedDashboardStates],
  ['provider jobs', webProviderJobsStates],
  ['provider enquiries', webProviderLeadsStates],
]) {
  if (!source.includes('ErrorState') || !source.includes('LoadingState')) {
    fail(`${surface} can no longer distinguish load failure from loading`);
  }
}
if (
  !webDealerInventoryStates.includes('EmptyState') ||
  !webDealerCustomersStates.includes('EmptyState') ||
  !webDealerOffersStates.includes('EmptyState') ||
  !webProviderJobsStates.includes('EmptyState') ||
  !webProviderLeadsStates.includes('EmptyState')
) {
  fail('Representative list journeys can no longer distinguish empty data from failure');
} else {
  ok('Representative cross-role journeys distinguish loading, empty and error states');
}

// Block 9 — shared visible terminology. Internal model/API names may stay
// technical (Lead, DealerProfile, ServiceJob), but the navigation and page
// labels for equivalent web/native product surfaces must not drift.
if (
  !webDealerRoutes.includes('label: "Stock"') ||
  !webDealerRoutes.includes('label: "Customers"') ||
  !webDealerRoutes.includes('label: "Offers"') ||
  !webDealerRoutes.includes('label: "Partner Account"') ||
  !webDealerRoutes.includes('label: "Service Jobs"') ||
  !webDealerRoutes.includes('label: "Service Enquiries"') ||
  !mobileDealerDrawer.includes("label: 'Stock'") ||
  !mobileDealerDrawer.includes("label: 'Customers'") ||
  !mobileDealerDrawer.includes("label: 'Offers'") ||
  !mobileDealerDrawer.includes("label: 'My Retail Offers'") ||
  !mobileDealerDrawer.includes("label: 'Saved Cars'") ||
  !mobileDealerDrawer.includes("label: 'Finance'") ||
  !mobileDealerCustomers.includes('>Customers</Text>') ||
  !mobileDealerOffers.includes('>Offers Received</Text>') ||
  !mobilePartnerDashboard.includes('>Service Jobs</Text>') ||
  !mobilePartnerDashboard.includes('>Finance & Warranty Enquiries</Text>') ||
  !mobileProviderJobs.includes('>Service Jobs</Text>') ||
  !mobileProviderLeads.includes('>Finance & Warranty Enquiries</Text>')
) {
  fail('Shared dealer/Partner terminology drifted between web and native clients');
} else {
  ok('Dealer and Partner navigation terminology is aligned across web and native');
}

// Dealer auction clients must use canonical dealership identity and the same
// fine-grained permissions as the backend. This specifically prevents staff
// accounts drifting back to personal winner IDs or exposing fee/bid mutations
// to Finance/Sales roles that do not own those permissions.
if (
  !webDealerLiveAuction.includes('dealerAccess?.ownerUserId ?? user?.id') ||
  !webDealerLiveAuction.includes("permissions?.includes('PLACE_BID')") ||
  !webDealerLiveAuction.includes("permissions?.includes('PAY_AUCTION_FEE')") ||
  !webDealerLiveAuction.includes('canManageSellerAuction') ||
  !webDealerWonAuctions.includes('hasPermission("PAY_AUCTION_FEE")') ||
  !webDealerWonAuctions.includes('hasPermission("PLACE_BID")')
) {
  fail('Web dealer auction UI can drift from canonical dealership identity or staff permissions');
} else {
  ok('Web dealer auction winner, bid and fee controls are dealership-permission aware');
}

if (
  !mobileDealerLiveAuction.includes('dealerAccess?.ownerUserId ?? currentUser?.id') ||
  !mobileDealerLiveAuction.includes("permissions?.includes('PLACE_BID')") ||
  !mobileDealerLiveAuction.includes("permissions?.includes('PAY_AUCTION_FEE')") ||
  !mobileDealerLiveAuction.includes('canManageSellerAuction') ||
  !mobileBuyerBids.includes('dealerAccess?.ownerUserId ?? currentUserId') ||
  !mobileBuyerBids.includes("permissions?.includes('PAY_AUCTION_FEE')") ||
  !mobileBuyerBids.includes('canPlaceBid && isCancelable(bid)') ||
  !mobileAuctionComplete.includes("permissions?.includes('PAY_AUCTION_FEE')") ||
  !mobileAuctionComplete.includes('!canPayAuctionFee')
) {
  fail('Native dealer auction UI can drift from canonical dealership identity or staff permissions');
} else {
  ok('Native dealer auction winner, bid and fee controls are dealership-permission aware');
}

// Block 7 provider foundation: one Partner business, service capabilities,
 // secure verification evidence and matching rules must all be reachable in
 // native mobile before these surfaces can be marked required.
if (
  !mobilePartnerDashboard.includes('getPartnerTeam') ||
  !mobilePartnerDashboard.includes('applyPartnerCapability') ||
  !mobilePartnerDashboard.includes('createStripeConnectOnboarding') ||
  !mobileProviderCapabilities.includes("navigation.navigate('ProviderVerification'") ||
  !mobileProviderCapabilities.includes("navigation.navigate('ProviderMatching'") ||
  !mobileProviderVerification.includes('getCapabilityVerification') ||
  !mobileProviderVerification.includes('uploadCapabilityAttachment') ||
  !mobileProviderVerification.includes('deleteCapabilityAttachment') ||
  !mobileProviderMatching.includes('updateJobMatching') ||
  !mobileProviderMatching.includes('updateLeadMatching') ||
  !mobileMainNavigator.includes('PartnerDashboard') ||
  !mobileMainNavigator.includes('ProviderCapabilities') ||
  !mobileMainNavigator.includes('ProviderVerification') ||
  !mobileMainNavigator.includes('ProviderMatching') ||
  !mobileGlobalDrawer.includes("stackScreen: 'PartnerDashboard'")
) {
  fail('Native Partner dashboard/capability foundation can drift from web TradeXchange provider contracts');
} else {
  ok('Native Partner dashboard, verification and matching foundation is present');
}

// Block 8 — notification routing and direct-open chat reliability.
// Expo pushes must carry the same routing identifiers the in-app notification
// row exposes, and both tap surfaces must share one native resolver.
const backendNotifications = read('backend/src/notifications/notifications.service.ts');
const mobileAppRoot = read('carmazium app/carmazium app/App.tsx');
const mobileNotificationsScreen = read('carmazium app/carmazium app/src/screens/main/NotificationsScreen.tsx');
const mobileNotificationRouting = read('carmazium app/carmazium app/src/lib/notificationRouting.ts');
const mobileChatScreen = read('carmazium app/carmazium app/src/screens/main/ChatScreen.tsx');

if (
  !backendNotifications.includes('type: dto.type') ||
  !backendNotifications.includes('entityType: dto.entityType') ||
  !backendNotifications.includes('entityId: dto.entityId') ||
  !backendNotifications.includes('actionType: dto.actionType') ||
  !backendNotifications.includes('notifId: notification.id')
) {
  fail('Expo push payload can drift from canonical notification routing metadata');
} else {
  ok('Expo pushes include canonical notification routing metadata');
}

if (
  !mobileAppRoot.includes('resolveMobileNotificationTarget') ||
  !mobileAppRoot.includes('markNotificationRead') ||
  !mobileAppRoot.includes('auth.authInitialized') ||
  !mobileNotificationsScreen.includes('resolveMobileNotificationTarget') ||
  !mobileNotificationRouting.includes('auctionToListingParam') ||
  !mobileNotificationRouting.includes("screen: 'ChatScreen'") ||
  !mobileNotificationRouting.includes('routeFromLink')
) {
  fail('Native notification list taps and OS push taps are not sharing one routing contract');
} else {
  ok('Native notification list, background and cold-start taps share one routing contract');
}

if (
  !mobileChatScreen.includes('roomRefreshAttemptRef') ||
  !mobileChatScreen.includes('refreshRooms().catch(() => {})') ||
  !mobileChatScreen.includes('[room, threadId, refreshRooms]')
) {
  fail('Native direct-open chat can regress to rendering before a newly created room is hydrated');
} else {
  ok('Native direct-open chat hydrates newly created rooms before relying on room metadata');
}

const webPricing = read('src/lib/pricingConfig.ts');
const mobilePricing = read('carmazium app/carmazium app/src/constants/pricing.ts');
const payments = read('backend/src/payments/payments.service.ts');
const boostService = read('backend/src/featured-boost/featured-boost.service.ts');
const services = read('backend/src/services/services.service.ts');

const webMarketplace = objectBlock(webPricing, 'marketplace');
const mobileMarketplace = objectBlock(mobilePricing, 'marketplace');
const webAuction = objectBlock(webMarketplace, 'auction');
const mobileAuction = objectBlock(mobileMarketplace, 'auction');
const webRetail = objectBlock(webMarketplace, 'retail');
const mobileRetail = objectBlock(mobileMarketplace, 'retail');

same('Auction seller listing fee', {
  web: numberProp(webAuction, 'sellerListingFee'),
  mobile: numberProp(mobileAuction, 'sellerListingFee'),
});
same('Auction buyer fee', {
  web: numberProp(webAuction, 'buyerFee'),
  mobile: numberProp(mobileAuction, 'buyerFee'),
  backend: numberConst(payments, 'AUCTION_BUYER_FEE'),
});
same('Auction seller reward', {
  web: numberProp(webAuction, 'sellerReward'),
  mobile: numberProp(mobileAuction, 'sellerReward'),
  backend: numberConst(payments, 'AUCTION_SELLER_BONUS'),
});
same('Auction duration hours', {
  web: numberProp(webAuction, 'durationHours'),
  mobile: numberProp(mobileAuction, 'durationHours'),
});
same('Retail seller listing fee', {
  web: numberProp(webRetail, 'sellerListingFee'),
  mobile: numberProp(mobileRetail, 'sellerListingFee'),
});
same('Retail buyer fee', {
  web: numberProp(webRetail, 'buyerFee'),
  mobile: numberProp(mobileRetail, 'buyerFee'),
});

const webListing = objectBlock(webPricing, 'listing');
const mobileListing = objectBlock(mobilePricing, 'listing');
for (const tier of ['basic', 'standard', 'premium']) {
  const webTier = objectBlock(webListing, tier);
  const mobileTier = objectBlock(mobileListing, tier);
  const backendFees = objectBlock(payments, 'LISTING_FEES');
  same(`Listing tier ${tier} price`, {
    web: numberProp(webTier, 'price'),
    mobile: numberProp(mobileTier, 'price'),
    backend: numberProp(backendFees, tier.toUpperCase()),
  });
  same(`Listing tier ${tier} HPI inclusion`, {
    web: boolProp(webTier, 'includesHpi'),
    mobile: boolProp(mobileTier, 'includesHpi'),
  });
}

const webHpi = objectBlock(webPricing, 'hpiReport');
const mobileHpi = objectBlock(mobilePricing, 'hpiReport');
same('HPI report price', {
  web: numberProp(webHpi, 'price'),
  mobile: numberProp(mobileHpi, 'price'),
  backend: numberConst(payments, 'HPI_REPORT_PRICE'),
});

const webBoost = objectBlock(webPricing, 'featuredBoost');
const mobileBoost = objectBlock(mobilePricing, 'featuredBoost');
same('Featured Boost price', {
  web: numberProp(webBoost, 'price'),
  mobile: numberProp(mobileBoost, 'price'),
  backendPayments: numberConst(payments, 'BOOST_PRICE'),
  backendBoost: numberConst(boostService, 'BOOST_AMOUNT'),
});
same('Featured Boost duration', {
  web: numberProp(webBoost, 'durationDays'),
  mobile: numberProp(mobileBoost, 'durationDays'),
  backend: numberConst(boostService, 'BOOST_DURATION_DAYS'),
});

const feeRateMatch = services.match(/feeRate\(\): number\s*\{\s*return\s+([0-9.]+)/);
if (!feeRateMatch) {
  fail('Could not read TradeXchange service fee rate from backend');
} else if (Number(feeRateMatch[1]) !== 0.09) {
  fail(`TradeXchange service fee rate changed to ${feeRateMatch[1]}; update the product contract and both clients together`);
} else {
  ok('TradeXchange service fee rate = 9% / provider share = 91%');
}

const webAuctionPricing = read('src/lib/auctionPricing.ts');
const mobileAuctionPricing = read('carmazium app/carmazium app/src/lib/auctionPricing.ts');
for (const constant of [
  'AUCTION_OPENING_BID_RATIO',
  'AUCTION_RESERVE_GUIDE_LOW_RATIO',
  'AUCTION_RESERVE_GUIDE_HIGH_RATIO',
]) {
  same(constant, {
    web: numberConst(webAuctionPricing, constant),
    mobile: numberConst(mobileAuctionPricing, constant),
  });
}

const webApi = read('src/lib/apiClient.ts');
const mobileApi = read('carmazium app/carmazium app/src/lib/apiClient.ts');
const apiUrl = /https:\/\/carmazium-[a-z0-9-]+\.fly\.dev/;
const webUrl = webApi.match(apiUrl)?.[0];
const mobileUrl = mobileApi.match(apiUrl)?.[0];
if (!webUrl || !mobileUrl) {
  fail('Could not identify fallback backend API URLs in both clients');
} else {
  same('Fallback backend API URL', { web: webUrl, mobile: mobileUrl });
}

if (process.exitCode) {
  console.error('\nOne-product parity guard failed.');
  process.exit(process.exitCode);
}

console.log('\nOne-product parity guard passed. Known gaps are listed above and tracked in product-parity.json.');
