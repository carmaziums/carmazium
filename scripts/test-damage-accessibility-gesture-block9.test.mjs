import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const nativeViewer = read('carmazium app/carmazium app/src/components/damage/ThreeDVehicleViewer.tsx');
const seller = read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx');
const mapper = seller.slice(seller.indexOf('function Damage3DMapper('), seller.indexOf('// ─── Main Screen'));
const buyer = read('carmazium app/carmazium app/src/components/damage/BuyerDamageViewer.tsx');
const pinLayout = read('carmazium app/carmazium app/src/components/damage/damagePinLayout.ts');
const webViewer = read('src/components/listing/ThreeDVehicleViewer.tsx');
const webMapper = read('src/components/listing/VehicleDamageMapper.tsx');
const webBuyer = read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx');

test('TalkBack/VoiceOver damage pin gives appropriate buyer or seller action, status and photo detail', () => {
  assert.match(nativeViewer, /readOnly \? 'Inspect this damage' : 'Edit this damage'/);
  assert.match(nativeViewer, /pin\.hasPhoto \? ' Photo attached\.' : ' No photo attached\.'/);
  assert.match(nativeViewer, /accessibilityState=\{\{ selected, disabled: !onDamagePinPress \}\}/);
  assert.match(nativeViewer, /accessibilityHint=\{readOnly \? 'Shows seller damage details and available photo'/);
  assert.match(nativeViewer, /importantForAccessibility="no-hide-descendants"/);
  assert.match(nativeViewer, /accessibilityLabel=\{readOnly/);
  assert.match(nativeViewer, /accessibilityHint="Damage numbers can also be selected from the accessible list below the vehicle\."/);
});

test('44dp saved pins, larger legacy hotspot target and directional toolbar avoid small tap areas', () => {
  assert.match(nativeViewer, /width: 44,\s*height: 44/);
  assert.match(nativeViewer, /hitSlop=\{\{ top: 14, bottom: 14, left: 14, right: 14 \}\}/);
  assert.match(nativeViewer, /accessibilityHint="Moves the vehicle view without requiring a drag gesture"/);
  assert.match(nativeViewer, /accessibilityState=\{\{ disabled: !modelReady \}\}/);
  assert.match(nativeViewer, /onTouchStart=\{\(\) => setInteracting\(true\)\}/);
  assert.match(nativeViewer, /onTouchEnd=\{\(\) => setInteracting\(false\)\}/);
  assert.match(nativeViewer, /onTouchCancel=\{\(\) => setInteracting\(false\)\}/);
});

test('native seller offers individual, accessible 48dp chooser that remains usable when 3D marks overlap', () => {
  assert.match(mapper, /accessibilityLabel="Recorded damage quick selector"/);
  assert.match(mapper, /records\.map\(\(record, index\) => \{/);
  assert.match(mapper, /key=\{record\.id\}/);
  assert.match(mapper, /onPress=\{\(\) => editDamage\(record\.id\)\}/);
  assert.match(mapper, /minHeight: 48, minWidth: 74/);
  assert.match(mapper, /accessibilityState=\{\{ selected, disabled: uploadingDamagePhoto \|\| pickingDamagePhoto \}\}/);
  assert.match(mapper, /when two 3D marks are close together or you cannot tap the model/);
});

test('native buyer can inspect individual seller evidence without needing the 3D model', () => {
  assert.match(buyer, /accessibilityLabel="Seller damage evidence quick selector"/);
  assert.match(buyer, /setSelectedDamageId\(previous => previous === record\.id \? null : record\.id\)/);
  assert.match(buyer, /minHeight: 48/);
  assert.match(buyer, /accessibilityHint="Shows this individual reported damage and its available photo"/);
  assert.match(buyer, /accessibilityState=\{\{ selected \}\}/);
  assert.match(buyer, /selectedRecord\.imageUrl/);
  assert.match(buyer, /readOnly/);
  assert.doesNotMatch(buyer, /onSurfaceTap=/);
});

test('selected marker is on top when a dense cluster exhausts displacement offsets', () => {
  assert.match(nativeViewer, /const orderedVisibleDamagePins = useMemo/);
  assert.match(nativeViewer, /Number\(left\.id === selectedDamageId\) - Number\(right\.id === selectedDamageId\)/);
  assert.match(nativeViewer, /orderedVisibleDamagePins\.map\(placed => \{/);
  assert.match(nativeViewer, /onPress=\{\(\) => onDamagePinPress\?\.\(pin\.id\)\}/);
  assert.match(pinLayout, /const MIN_DISTANCE = 49/);
  assert.match(pinLayout, /displaced: best\.distance > 5/);
  assert.doesNotMatch(pinLayout, /surfacePoint\s*=|damagePhotoUrl\s*=/);
});

test('pending upload locks seller editor actions and screen reader announces exact save action', () => {
  assert.match(mapper, /disabled=\{pickingDamagePhoto \|\| uploadingDamagePhoto\}/);
  assert.match(mapper, /disabled=\{uploadingDamagePhoto \|\| pickingDamagePhoto\}/);
  assert.match(mapper, /editingDamageId \? 'Save changes to selected damage' : 'Save damage and add another'/);
  assert.match(mapper, /'Retry saving damage'/);
  assert.match(mapper, /accessibilityLabel=\{`Remove damage \$\{records\.indexOf\(r\) \+ 1\}/);
  assert.match(mapper, /accessibilityState=\{\{ selected: dmgType === t, disabled: pickingDamagePhoto \|\| uploadingDamagePhoto \}\}/);
});

test('web touch gesture stays in WebGL, with mouse drag threshold and 44px focused damage pin', () => {
  assert.match(webViewer, /touchAction: "none"/);
  assert.match(webViewer, /if \(event\.delta > 8\) return/);
  assert.match(webViewer, /role="group"/);
  assert.match(webViewer, /manual area selector/);
  assert.match(webViewer, /h-11 w-11/);
  assert.match(webViewer, /focus:ring-4 focus:ring-white/);
  assert.match(webViewer, /aria-pressed=\{selectedDamageId === pin\.id\}/);
  assert.match(webViewer, /\$\{onSurfaceTap \? 'Edit' : 'Inspect'\}/);
});

test('keyboard-only and reduced dexterity web users keep manual area and damage list paths', () => {
  assert.match(webMapper, /aria-expanded=\{manualOpen\}/);
  assert.match(webMapper, /Choose area manually/);
  assert.match(webMapper, /onClick=\{\(\) => editRecord\(rec\.id\)\}/);
  assert.match(webMapper, /onClick=\{addRecord\}/);
  assert.match(webBuyer, /aria-pressed=\{selectedDamageId === record\.id\}/);
  assert.match(webBuyer, /onClick=\{\(\) => setSelectedDamageId/);
  assert.match(webBuyer, /setDamagePhotoUrl\(record\.imageUrl\)/);
});

test('accessibility updates do not grant buyer write capability or alter data/proof protocol', () => {
  assert.match(nativeViewer, /!readOnly && !!onSurfaceTap/);
  assert.match(buyer, /readOnly/);
  assert.match(seller, /damagePhotoUrl: source/);
  assert.match(webMapper, /const updated = edited \? records\.map/);
  assert.match(webBuyer, /buyerDamagePins = damageRecords\.flatMap/);
});
