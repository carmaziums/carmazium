#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = path => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');
const files = {
  login: get('screens/auth/LoginScreen.tsx'),
  signup: get('screens/auth/SignupScreen.tsx'),
  postSignup: get('screens/auth/PostSignupOnboardingScreen.tsx'),
  dealerOnboard: get('screens/main/DealerOnboardingScreen.tsx'),
  dealerKyc: get('screens/main/DealerKYCScreen.tsx'),
  providerVerify: get('screens/main/ProviderVerificationScreen.tsx'),
  providerJobs: get('screens/main/ProviderJobsScreen.tsx'),
  providerDetail: get('screens/main/ProviderJobDetailScreen.tsx'),
  purchase: get('screens/main/PurchaseFlowScreen.tsx'),
  history: get('screens/account/PaymentHistoryScreen.tsx'),
  dealerPurchases: get('screens/main/DealerPurchasesScreen.tsx'),
};

const palettes = [
 ['login','useLoginScreenPalette',['container','titleText','input','inputWrapper','socialBtn']],
 ['signup','useSignupScreenPalette',['container','roleCard','roleCardLabel','input','checkbox']],
 ['postSignup','usePostSignupOnboardingScreenPalette',['container','emailCard','fieldLabel','guideCard']],
 ['dealerOnboard','useDealerOnboardingScreenPalette',['container','businessTypeCard','inputWrap','textInput']],
 ['dealerKyc','useKycThemeStyles',['container','headerTitle','statusBanner','docTapArea','paymentOutstandingContainer','pendingHeading']],
 ['providerVerify','useProviderVerificationScreenPalette',['container','summaryCard','requirement','fileButton','input']],
 ['providerJobs','useProviderJobsScreenPalette',['container','headerTitle','card','filter','centerCard']],
 ['providerDetail','useProviderJobDetailScreenPalette',['container','card','input','choice','moneyField']],
 ['purchase','usePurchaseFlowScreenPalette',['container','heroCard','summaryBox','paymentNote','floatingBottom']],
 ['history','usePaymentHistoryScreenPalette',['container','summaryCard','filterChip','txCard','txAmount']],
 ['dealerPurchases','useDealerPurchasesScreenPalette',['container','totalsCard','purchaseCard','modalValue','sellerActionBtn']],
];

test('eleven onboarding, KYC, provider and financial UI screens subscribe to semantic appearance without changing global colours', () => {
  for (const [name,hook,keys] of palettes) {
    const s=files[name];
    assert.ok(s.includes('function '+hook+'()'), name+' theme hook');
    assert.ok(s.includes('useNativeAppearance()'), name+' theme subscription');
    for(const key of keys) assert.ok(s.includes(key+': [styles.'+key+', { '),name+'.'+key);
    assert.doesNotMatch(s, /Object\.assign\(Colors|Colors\.[a-zA-Z]+\s*=/);
  }
});

test('signup remains user-consented, role-aware and identity flows retain validation', () => {
  const s=files.signup;
  assert.match(s, /setAgreeTerms\(!agreeTerms\)/);
  assert.match(s, /password\.length >= 8 && passwordsMatch && agreeTerms/);
  assert.match(s, /setRole\(opt\.value\)/);
  assert.match(s, /roleCard: \[styles\.roleCard, \{ backgroundColor: palette\.bgCard/);
  assert.match(files.login, /supabase\.auth\.signInWithOAuth/);
  assert.match(files.postSignup, /UK_POSTCODE_REGEX/);
  assert.match(files.postSignup, /£125 CarMazium buyer fee applies/);
  assert.match(files.dealerOnboard, /'SOLE_PROPRIETORSHIP'/);
  assert.match(files.dealerOnboard, /'PRIVATE_LIMITED'/);
});

test('KYC shell preserves original £1 payment proof and document review gates', () => {
  const s=files.dealerKyc;
  assert.match(s, /route\?\.params\?\.businessType === 'SOLE_PROPRIETORSHIP'/);
  assert.match(s, /handleDocumentCapture\(field, type\)/);
  assert.match(s, /COMPLETE PAYMENT \(£1\)/);
  assert.match(s, /onPress=\{handleSubmit\}/);
  assert.match(s, /url=\{kycCheckoutUrl\}/);
  assert.match(s, /const \{ palette, resolvedAppearance \} = useNativeAppearance\(\)/);
  assert.match(s, /placeholderTextColor=\{palette\.textMuted\}/);
  assert.match(s, /const PendingView: React\.FC/);
  assert.match(s, /const KycSkeleton: React\.FC/);
});

test('provider verification and jobs keep evidence upload, pricing and completion transitions untouched', () => {
  assert.match(files.providerVerify, /uploadCapabilityAttachment\(/);
  assert.match(files.providerVerify, /disabled=\{busy \|\| !file \|\| !evidenceType\}/);
  assert.match(files.providerVerify, /deleteCapabilityAttachment\(/);
  assert.match(files.providerJobs, /getProviderJobs|fetchProviderJobs|listProviderJobs/);
  assert.match(files.providerDetail, /upsertProviderQuote\(/);
  assert.match(files.providerDetail, /withdrawProviderQuote\(/);
  assert.match(files.providerDetail, /completeProviderJob\(/);
  assert.match(files.providerDetail, /getOrCreateServiceJobRoom/);
  assert.match(files.providerDetail, /setInspectionOutcome\('FAULTS_FOUND'\)/);
});

test('financial screens keep £125 platform fee, native Stripe and real ledger', () => {
  const s=files.purchase;
  assert.match(s, /buyerFee: number/);
  assert.match(s, /createPaymentSheet/);
  assert.match(s, /reconcileAuctionFeeIntent/);
  assert.match(s, /initPaymentSheet/);
  assert.match(s, /presentPaymentSheet/);
  assert.match(s, /£125 buyer fee within 72 hours/);
  assert.match(files.history, /const \{ palette, resolvedAppearance \} = useNativeAppearance\(\)/);
  assert.match(files.dealerPurchases, /handleEmailSeller\(summaryItem\)/);
  assert.match(files.dealerPurchases, /handleCallSeller\(summaryItem\)/);
});

test('inactive Appearance control and customer APK release gates have not been changed', () => {
  const settings=get('screens/main/SettingsScreen.tsx');
  assert.match(settings,/A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings,/setAppearancePreference\(/);
  for (const s of Object.values(files)) assert.doesNotMatch(s,/NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED/);
});
