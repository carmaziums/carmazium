#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = '../carmazium app/carmazium app/src/';
const src = path => readFileSync(new URL(base + path, import.meta.url), 'utf8');
const landing = src('screens/sell/SellLandingScreen.tsx');
const wizard = src('screens/sell/SellCarFlowScreen.tsx');
const detail = src('screens/vehicle/VehicleDetailScreen.tsx');
const auction = src('screens/vehicle/AuctionDetailScreen.tsx');
const buyer = src('screens/buyer/BuyerOffersScreen.tsx');
const seller = src('screens/seller/SellerOffersScreen.tsx');
const ledger = src('components/offers/CounterLedger.tsx');
const price = src('components/ui/Price.tsx');
const stripe = src('components/StripeCheckoutModal.tsx');
const settings = src('screens/main/SettingsScreen.tsx');

function expectThemeStyles(content, hook, names, sourceName = 'styles') {
  assert.match(content, new RegExp('function ' + hook + '\\(\\) \\{'));
  assert.match(content, /const \{ palette \} = useNativeAppearance\(\)/);
  for(const name of names) {
    assert.match(content, new RegExp(name + ': \\[' + sourceName + '\\.' + name + ', \\{ '), hook + '.' + name);
  }
}

test('seller valuation uses correctly contrasted £0 auction and £1 retail journeys', () => {
  expectThemeStyles(landing,'useSellLandingStyles',
    ['screen','title','valuationCard','guidePrice','retailAction','benefit','actionSub']);
  assert.match(landing, /<ThemedTextField style=\{styles\.fieldInput\}/);
  assert.match(landing, /actionSub: \[styles\.actionSub, \{ color: palette\.textSecondary \}\]/);
  assert.match(landing, /<Text style=\{\[themed\.actionSub, \{ color: palette\.accentForeground \}\]\}>£0 listing fee/);
  assert.match(landing, /£1 Retail Listing/);
  assert.match(landing, /after approved handover/);
  assert.match(landing, /Vehicle payment is made directly to the seller/);
  assert.match(landing, /normalizeNativeRegistration/);
  assert.match(landing, /getVehicleValuation/);
});

test('wizard only themes presentation, not DVLA/drafts/validation/price or payment semantics', () => {
  expectThemeStyles(wizard,'useSellWizardStyles',
    ['container','headerTitle','methodChoice','input','sectionBox','priceInputWrap','badgeCard','declRow',
      'declText','checkbox','reviewHeading','bottomBar','backBtnSm','backBtnSmText','photoTabs']
      .filter(x => x !== 'input' && x !== 'sectionBox'));
  assert.match(wizard, /const \{ palette, resolvedAppearance \} = useNativeAppearance\(\)/);
  assert.match(wizard, /<TextInput\s*\n\s*style=\{\[s\.input, \{ backgroundColor: palette\.bgInput/);
  assert.match(wizard, /backgroundColor: palette\.bgCard, borderColor: palette\.borderDefault/);
  assert.match(wizard, /color: palette\.textPrimary/);
  assert.match(wizard, /const \{ initPaymentSheet, presentPaymentSheet \} = useStripe\(\)/);
  assert.match(wizard, /await createPaymentSheet\(\{ listingId, amount, type: 'LISTING_FEE'/);
  assert.match(wizard, /await presentPaymentSheet\(\)/);
  assert.match(wizard, /nativeAuctionDraftReady/);
  assert.match(wizard, /loadSellWizardDraftForUser/);
  assert.match(wizard, /getAuctionReserveGuide/);
  assert.match(wizard, /getVehicleValuation/);
  assert.match(wizard, /handlePublish/);
  assert.match(wizard, /placeholderTextColor=\{Colors\.blackAlpha45\}/);
});

test('retail vehicle details and offer modal preserve actual price and real seller information', () => {
  expectThemeStyles(detail,'useVehicleDetailStyles',
    ['container','detailsBlock','carTitle','priceText','monthlyText','specRowValue','sellerCard',
     'sellerName','offerAmountInput','offerMessageInput','modalTitle','stickyCTAOuter',
     'financeCalcBody','financeDisclaimer','hpiCheckLabel']);
  assert.match(detail, /getListingById/);
  assert.match(detail, /const \{ listing \} = route\.params/);
  assert.match(detail, /formatPrice\(listing\.price\)/);
  assert.match(detail, /createChatRoom/);
  assert.match(detail, /<BottomSheet/);
  assert.match(detail, /onPress=\{handleToggleSaved\}/);
  assert.match(detail, /Illustrative monthly estimate only, not a finance offer/);
});

test('auction details use readable bid, contact and fee UI without touching bidding security', () => {
  expectThemeStyles(auction,'useAuctionDetailStyles',
    ['container','headerTitle','card','bidConsole','currentBidVal','customBidInput',
     'feeNotice','feeNoticeHint','feeNoticeAmt','sellerContactBlock','binPanel','binPanelPrice']);
  assert.match(auction, /const canPlaceBid =/);
  assert.match(auction, /if \(!canPlaceBid\)/);
  assert.match(auction, /getAuctionFirstOfferFloor/);
  assert.match(auction, /triggerBuyItNow/);
  assert.match(auction, /buyer fee must be paid by a dealership Owner, Admin or Finance Manager/);
  assert.match(auction, /<Text style=\{\[themed\.feeNoticeAmt, \{ fontFamily: FontFamily\.mono \}\]\}>£125<\/Text>/);
  assert.match(auction, /Pay the vehicle seller directly after inspection and agreement/);
});

test('buyer and seller offer styles remain distinct from real offer state, counters and sale logic', () => {
  expectThemeStyles(buyer,'useBuyerOfferStyles',
    ['container','headerTitle','offerCard','offerAmount','counterAmount','counterBackInput','deliveryFormInput']);
  expectThemeStyles(seller,'useSellerOfferStyles',
    ['container','headerTitle','offerCard','buyerName','offerAmount','counterInput','modalBtnCancel','toast']);
  assert.match(buyer, /\n    themed,\n  \]\);/);
  assert.match(seller, /\n    themed,\n  \]\);/);
  assert.match(buyer, /<CounterLedger/);
  assert.match(seller, /<CounterLedger/);
  assert.match(buyer, /<KeyboardStickyView/);
  assert.match(buyer, /<FlatList/);
  assert.match(seller, /<FlatList/);
  assert.match(seller, /handleConfirmSale/);
  assert.match(seller, /editable=\{false\}/);
});

test('offer negotiation ledger and shared price render dark/light semantic text but preserve actual amounts', () => {
  assert.match(ledger, /useNativeAppearance\(\)/);
  assert.match(ledger, /backgroundColor: palette\.bgCard, borderColor: palette\.borderDefault/);
  assert.match(ledger, /color: palette\.textPrimary/);
  assert.match(ledger, /sellerCounterAmount \?\? offer\.counterAmount \?\? null/);
  assert.match(ledger, /buyerCounterAmount \?\? null/);
  assert.match(ledger, /fmtPrice\(row\.amount\)/);
  assert.match(price, /useNativeAppearance\(\)/);
  assert.match(price, /muted \? palette\.textSecondary : palette\.textPrimary/);
  assert.match(price, /formatValue\(value, fallback\)/);
  assert.match(price, /\$\{currency\}\$\{formatted\}/);
});

test('hosted Stripe checkout only changes modal chrome, not the payment WebView or redirects', () => {
  assert.match(stripe, /useNativeAppearance\(\)/);
  assert.match(stripe, /borderBottomColor: palette\.borderDefault/);
  assert.match(stripe, /color: palette\.textPrimary/);
  assert.match(stripe, /source=\{\{ uri: url \}\}/);
  assert.match(stripe, /onNavigationStateChange=\{handleNav\}/);
  assert.match(stripe, /onSuccess\(\)/);
  assert.match(stripe, /onCancel\?\.\(\)/);
  assert.match(stripe, /onRequestClose=\{onClose\}/);
});

test('Appearance settings are not exposed until all buyer/dealer/seller screens are migrated', () => {
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings, /setAppearancePreference\(/);
});
