#!/usr/bin/env node
/**
 * Issue #502 / Block 10: source inventory and explicit NO-GO device-QA handoff.
 *
 * A source-colour hook is not proof that a screen is readable or matches the
 * website. This tool never claims app release approval, successful APK
 * installation, physical iPhone validation, screenshot parity or backend
 * isolation. It reads files only, never contacts production or changes GitHub.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';

export const REQUIRED_CRITICAL_SCREENS = Object.freeze([
  'auth/LoginScreen.tsx',
  'auth/SignupScreen.tsx',
  'account/UnifiedDashboardScreen.tsx',
  'main/HomeScreen.tsx',
  'main/SearchScreen.tsx',
  'main/LiveScreen.tsx',
  'main/SettingsScreen.tsx',
  'main/MessagesScreen.tsx',
  'main/ChatScreen.tsx',
  'main/NotificationsScreen.tsx',
  'main/NotificationSettingsScreen.tsx',
  'main/DealerInventoryScreen.tsx',
  'main/DealerLeadsScreen.tsx',
  'main/DealerTeamScreen.tsx',
  'main/DealerAnalyticsScreen.tsx',
  'main/DealerKYCScreen.tsx',
  'main/PurchaseFlowScreen.tsx',
  'main/ProviderJobsScreen.tsx',
  'main/ProviderJobDetailScreen.tsx',
  'sell/SellLandingScreen.tsx',
  'sell/SellCarFlowScreen.tsx',
  'buyer/BuyerOffersScreen.tsx',
  'seller/SellerOffersScreen.tsx',
  'vehicle/VehicleDetailScreen.tsx',
  'vehicle/AuctionDetailScreen.tsx',
]);

const read = path => readFileSync(path, 'utf8');
const sorted = arr => [...arr].sort((a,b) => a.localeCompare(b,'en'));
const readScreenFiles = (root, prefix = '') => {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...readScreenFiles(join(root, entry.name), join(prefix, entry.name)));
    else if (entry.isFile() && entry.name.endsWith('Screen.tsx')) {
      out.push({ path: join(prefix, entry.name).replaceAll('\\', '/'), content: read(join(root, entry.name)) });
    }
  }
  return out;
};

export function assessNativeThemeQaSource({
  screens = [],
  settings = '',
  qaWorkflow = '',
  downloads = '',
  visualChecker = '',
  releaseChecker = '',
  sourceSha = null,
} = {}) {
  const byName = new Map(screens.map(row => [row.path, row.content]));
  const appearanceAware = sorted(screens.filter(row =>
    /useNativeAppearance\s*\(\s*\)/.test(row.content) && /palette\./.test(row.content)
  ).map(row => row.path));
  const notProvenBySource = sorted(screens.map(row => row.path).filter(name => !appearanceAware.includes(name)));
  const missingCritical = REQUIRED_CRITICAL_SCREENS.filter(path => !byName.has(path));
  const criticalWithoutThemeSource = REQUIRED_CRITICAL_SCREENS.filter(path =>
    byName.has(path) && !appearanceAware.includes(path));
  const appearanceSelectorStillDisabled =
    settings.includes('A live light/dark switch is not yet supported by the native theme engine.');
  const qaSeparation =
    qaWorkflow.includes("EXPO_PUBLIC_QA_READ_ONLY: '1'") &&
    qaWorkflow.includes("app.expo.android.package = 'uk.carmazium.qa'") &&
    qaWorkflow.includes('app.expo.updates.enabled = false') &&
    qaWorkflow.includes('CarMazium-Android-QA') &&
    qaWorkflow.includes('actions/upload-artifact@v4');
  const downloadGuard =
    downloads.includes('NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED !== "true"') &&
    downloads.includes('NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256') &&
    downloads.includes('["carmazium.com", "www.carmazium.com"]');
  const privateVisualEvidenceChecker =
    visualChecker.includes('readPngEvidence') &&
    visualChecker.includes('staging.separateFromProduction !== true') &&
    visualChecker.includes('REQUIRED_SCENARIOS') &&
    visualChecker.includes('VIEWPORTS');
  const customerReleaseFailsClosed =
    releaseChecker.includes('public_download_approved: false') &&
    releaseChecker.includes('MANUAL_RELEASE_REVIEW_REQUIRED');

  const blockers = [
    { id: 'PHYSICAL_ANDROID_QA_PENDING', reason: 'No independently checked Samsung APK installation, screenshots, or real gestures/taps are supplied to this source audit.' },
    { id: 'PHYSICAL_IOS_QA_PENDING', reason: 'No Apple-signed TestFlight build, physical iPhone evidence or VoiceOver review is supplied.' },
    { id: 'WEBSITE_NATIVE_SCREENSHOT_PARITY_PENDING', reason: 'Light/Dark/System web↔Android↔iPhone screenshot evidence has not been independently supplied and reviewed.' },
    { id: 'QA_BACKEND_NOT_ISOLATED', reason: 'Existing QA APK uses a public preview environment that may reach live services. No isolated synthetic staging is proven. Do not test payments, bidding, KYC, chat or customer mutations.' },
    { id: 'SIGNED_RELEASE_APK_NOT_VERIFIED', reason: 'A debug-signed QA APK is not the owner-pinned production-signed uk.carmazium.app binary; provenance, upgrades and certificate continuity remain unverified.' },
    { id: 'OWNER_RELEASE_APPROVAL_PENDING', reason: 'No owner approval tied to an exact verified public APK SHA-256 or iOS build is present.' },
  ];
  if (appearanceSelectorStillDisabled)
    blockers.push({ id: 'APPEARANCE_SELECTOR_DISABLED', reason: 'The current Settings UI truthfully keeps the live Light/Dark/System selector unavailable until real-device acceptance.' });
  else blockers.push({ id: 'APPEARANCE_SELECTOR_UNVERIFIED', reason: 'The source scanner cannot certify an enabled Appearance selector; independent device tests remain required.' });
  if (missingCritical.length)
    blockers.push({ id: 'CRITICAL_SCREENS_MISSING', reason: 'Critical screen files absent: ' + missingCritical.join(', ') });
  if (criticalWithoutThemeSource.length)
    blockers.push({ id: 'CRITICAL_THEME_SOURCE_GAPS', reason: 'These key screens have no detectable semantic appearance use; inspect them: ' + criticalWithoutThemeSource.join(', ') });
  if (!qaSeparation)
    blockers.push({ id: 'QA_PACKAGE_GUARD_MISSING', reason: 'Separate read-only QA package, OTA-off and private artifact contract must be restored.' });
  if (!downloadGuard)
    blockers.push({ id: 'WEBSITE_DOWNLOAD_GUARD_MISSING', reason: 'Public APK flag/host/hash safety controls must remain intact.' });
  if (!privateVisualEvidenceChecker || !customerReleaseFailsClosed)
    blockers.push({ id: 'EVIDENCE_GATES_MISSING', reason: 'The independent private-PNG acceptance and fail-closed public release auditors must stay intact.' });

  return {
    programme: 'issue502-native-theme-block10',
    source_sha: typeof sourceSha === 'string' && /^[a-f0-9]{40}$/i.test(sourceSha) ? sourceSha : null,
    conclusion: 'NO_GO_DEVICE_EVIDENCE_REQUIRED',
    public_download_approved: false,
    appearance_toggle_approved: false,
    private_qa_build_verified: false,
    device_visual_accepted: false,
    coverage: {
      total_screen_files: screens.length,
      semantic_palette_source_markers: appearanceAware.length,
      screens_without_palette_source_markers: notProvenBySource,
      critical_screen_count: REQUIRED_CRITICAL_SCREENS.length,
      critical_screens_missing: missingCritical,
      critical_screens_without_palette_source_markers: criticalWithoutThemeSource,
      warning: 'Heuristic source markers are neither functional tests nor screenshot evidence. A screen with markers can still be unreadable.',
    },
    source_safeguards: {
      qa_package_readonly_ota_off_private_artifact: qaSeparation,
      public_apk_flag_host_sha_gate: downloadGuard,
      independent_private_png_visual_checker: privateVisualEvidenceChecker,
      customer_release_evidence_fails_closed: customerReleaseFailsClosed,
    },
    blockers,
  };
}

export function auditNativeThemeQaRepository(repositoryRoot, sourceSha = null) {
  const root = resolve(repositoryRoot);
  const appRoot = join(root, 'carmazium app', 'carmazium app', 'src');
  const file = p => {
    const target = join(root, p);
    return existsSync(target) ? read(target) : '';
  };
  return assessNativeThemeQaSource({
    screens: readScreenFiles(join(appRoot, 'screens')),
    settings: file('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx'),
    qaWorkflow: file('.github/workflows/carmazium-android-offline-qa-apk.yml'),
    downloads: file('src/lib/mobileAppDownloads.ts'),
    visualChecker: file('scripts/verify-native-visual-acceptance.mjs'),
    releaseChecker: file('scripts/check-customer-app-release-acceptance.mjs'),
    sourceSha,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  try {
    const out = auditNativeThemeQaRepository(root, process.argv[2] || null);
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    // Source inventory cannot replace offline device evidence and can never
    // be used as a CI/public release approval switch.
    process.exitCode = 2;
  } catch (error) {
    console.error('Native Block 10 QA inventory BLOCKED: ' + String(error.message || error));
    process.exitCode = 2;
  }
}
