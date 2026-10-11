import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const service = read('backend/src/damage/damage.service.ts');
const controller = read('backend/src/damage/damage.controller.ts');
const permissionTests = read('backend/src/damage/damage.security.spec.ts');
const nativeManifest = JSON.parse(read('carmazium app/carmazium app/app.json'));
const qaWorkflow = read('.github/workflows/carmazium-android-offline-qa-apk.yml');

test('damage mutation takes validated session principal and performs DB authorization in transaction', () => {
  assert.match(controller, /@UseGuards\(SessionAuthGuard\)/);
  assert.match(controller, /@CurrentUser\(\) user: \{ id: string \}/);
  assert.match(controller, /saveDamageRecords\(listingId, body\?\.detections, user\?\.id\)/);
  assert.match(service, /async saveDamageRecords\(listingId: string, detections: DamageDetection\[\], callerId: string\)/);
  assert.match(service, /return this\.prisma\.\$transaction\(async tx => \{/);
  assert.match(service, /sellerId === actor\.id/);
  assert.match(service, /actor\.role === 'ADMIN'/);
  assert.match(service, /dealerProfileId: dealership\.id, isActive: true/);
  assert.match(service, /role: \{ in: \['ADMIN', 'SALES_AGENT'\] \}/);
  assert.match(service, /if \(!owner && !admin && !authorisedStaff\)/);
  const guardIndex = service.indexOf('if (!owner && !admin && !authorisedStaff)');
  const deleteIndex = service.indexOf('await tx.damageRecord.deleteMany(');
  assert.ok(guardIndex > -1 && deleteIndex > guardIndex);
});

test('damage records validate UUID, geometry and seller-scoped HTTPS photo before replacement', () => {
  assert.match(service, /detections\.length > 100/);
  assert.match(service, /Duplicate damage record identifier/);
  assert.match(service, /Damage identifier already belongs to another listing/);
  assert.match(service, /Invalid damage map coordinates/);
  assert.match(service, /Invalid 3D damage marker location/);
  assert.match(service, /storageOrigin && photoUrl\.origin === storageOrigin/);
  assert.match(service, /photoUrl\.pathname\.startsWith\(ownerPrefix\)/);
  assert.match(service, /Damage photo must belong to this listing/);
  assert.match(service, /priorPhotoUrls\.has\(d\.imageUrl\)/);
  assert.match(service, /await tx\.damageRecord\.deleteMany\(\{ where: \{ listingId \} \}\)/);
});

test('unpublished listing damage is never publicly readable, while active buyer view works', () => {
  assert.match(controller, /@UseGuards\(OptionalSessionAuthGuard\)/);
  assert.match(controller, /getDamageRecords\(listingId, user\?\.id\)/);
  assert.match(service, /const visible = \['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'\]/);
  assert.match(service, /if \(!callerId\) throw new NotFoundException/);
  assert.match(service, /if \(!allowed\) throw new NotFoundException/);
});

test('synthetic owner, buyer, dealer staff, admin, invalid proof and privacy Jest tests are present', () => {
  for (const clue of [
    'requires authenticated principal',
    'accepts the exact listing owner',
    'blocks a different seller or retail buyer',
    'grants a verified active dealership membership',
    'permits a current database administrator',
    'rejects foreign URLs, local URIs',
    'keeps unpublished listing records private',
  ]) assert.ok(permissionTests.includes(clue));
});

test('native photo-capture permission is requestable without opening mic access', () => {
  assert.ok(!nativeManifest.expo.android.blockedPermissions.includes('android.permission.CAMERA'));
  assert.ok(nativeManifest.expo.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  const plugin = nativeManifest.expo.plugins.find(item => Array.isArray(item) && item[0] === 'expo-image-picker');
  assert.ok(plugin && typeof plugin[1].cameraPermission === 'string' && plugin[1].cameraPermission.includes('vehicle'));
  assert.equal(plugin[1].microphonePermission, false);
});

test('private Android QA workflow is isolated from live install, release channel and production writes', () => {
  assert.match(qaWorkflow, /workflow_dispatch:/);
  assert.match(qaWorkflow, /EXPO_PUBLIC_QA_READ_ONLY: '1'/);
  assert.match(qaWorkflow, /app\.expo\.android\.package = 'uk\.carmazium\.qa'/);
  assert.match(qaWorkflow, /app\.expo\.updates\.enabled = false/);
  assert.match(qaWorkflow, /app\.expo\.android\.intentFilters = \[\]/);
  assert.match(qaWorkflow, /actions\/upload-artifact@v4/);
  assert.match(qaWorkflow, /retention-days: 7/);
  assert.doesNotMatch(qaWorkflow, /eas-cli.*submit/);
});

test('web and native sellers cannot publish or pay after failed damage evidence save', () => {
  const web = read('src/components/listing/ListingWizard.tsx');
  const native = read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx');
  assert.match(native, /const damageSaved = newListingId \? await saveDamageRecords\(newListingId\) : true;/);
  assert.match(native, /if \(!damageSaved\) \{[\s\S]*?setHpiDraftListingId\(newListingId\);[\s\S]*?return;/);
  assert.ok(native.indexOf('if (!damageSaved) {') < native.indexOf('if (isAuction && newListingId) {'));
  assert.match(native, /if \(!damageSaved\) \{[\s\S]*?Damage not saved[\s\S]*?return;/);
  assert.match(web, /throw new Error\('Damage evidence was not saved\./);
  assert.match(web, /throw new Error\('Damage details were not saved\./);
  assert.match(web, /throw new Error\('The Retail listing was created but its damage details could not be saved\./);
  const caughtAndRethrown = [...web.matchAll(/catch \(e\) \{[\s\S]{0,160}?console\.error\('Failed to save damage records/g)].length;
  assert.ok(caughtAndRethrown >= 4);
});
