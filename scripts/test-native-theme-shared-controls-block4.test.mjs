#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = path => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');
const button = src('components/Button.tsx');
const iconButton = src('components/IconButton.tsx');
const card = src('components/ui/Card.tsx');
const glassCard = src('components/GlassCard.tsx');
const sheet = src('components/BottomSheet.tsx');
const toast = src('components/Toast.tsx');
const field = src('components/ThemedTextField.tsx');
const location = src('components/LocationPromptSheet.tsx');
const profile = src('components/ProfileCompletionPromptSheet.tsx');
const auction = src('components/filters/AuctionFilterSheet.tsx');
const theme = src('theme/nativeTheme.ts');

test('both website semantic palettes have legible form text and stable red CTAs', () => {
  for (const mode of ['LIGHT', 'DARK']) {
    const match = theme.match(new RegExp('NATIVE_' + mode + '_THEME: NativeSemanticPalette = Object.freeze\\(\\{([\\s\\S]*?)\\}\\)'));
    assert.ok(match, mode + ' palette');
    const vals = Object.fromEntries([...match[1].matchAll(/(\w+): '([^']+)'/g)].map(([, k, v]) => [k, v]));
    assert.ok(vals.bgInput && vals.bgCard && vals.bgDropdown && vals.textPrimary && vals.borderDefault);
    assert.equal(vals.accent, '#ed1c24');
    assert.equal(vals.accentForeground, '#ffffff');
    assert.notEqual(vals.bgInput, vals.textPrimary);
    assert.notEqual(vals.bgDropdown, vals.textPrimary);
  }
});

test('primary button uses white foreground even in Light mode; disabled state and interactions survive', () => {
  assert.match(button, /useNativeAppearance\(\)/);
  assert.match(button, /variant === 'primary' \? palette\.accentForeground : palette\.textPrimary/);
  assert.match(button, /backgroundColor: palette\.bgCard, borderColor: palette\.borderDefault/);
  assert.match(button, /const isDisabled = disabled \|\| loading/);
  assert.match(button, /accessibilityState=\{\{ disabled: isDisabled, busy: loading \}\}/);
  assert.match(button, /disabled=\{isDisabled\}/);
});

test('icon-only buttons preserve labelled 44pt hit targets while theming neutral fills', () => {
  assert.match(iconButton, /useNativeAppearance\(\)/);
  assert.match(iconButton, /const iconColor = color \?\? palette\.textPrimary/);
  assert.match(iconButton, /minWidth: MIN_HIT_TARGET/);
  assert.match(iconButton, /minHeight: MIN_HIT_TARGET/);
  assert.match(iconButton, /borderColor: palette\.borderDefault/);
  assert.match(iconButton, /accessibilityLabel=\{accessibilityLabel\}/);
});

test('shared cards use light/dark semantic fill and border without changing clipping/elevation', () => {
  assert.match(card, /useNativeAppearance\(\)/);
  assert.match(card, /variant === 'solid' \? palette\.bgDropdown : palette\.bgCard/);
  assert.match(card, /borderColor: active \? palette\.accent : palette\.borderDefault/);
  assert.match(card, /Platform\.OS === 'ios'/);
  assert.match(card, /styles\.transparent/);
  assert.match(card, /Elevation\.card/);
  assert.match(glassCard, /useNativeAppearance\(\)/);
  assert.match(glassCard, /backgroundColor: palette\.bgCard/);
  assert.match(glassCard, /borderColor: palette\.borderDefault/);
  assert.match(glassCard, /backgroundColor: palette\.borderHover/);
});

test('shared modal has palette background and readable title, while drag, keyboard and close still work', () => {
  assert.match(sheet, /useNativeAppearance\(\)/);
  assert.match(sheet, /backgroundColor: palette\.bgDropdown, borderColor: palette\.borderDefault/);
  assert.match(sheet, /color: palette\.textPrimary/);
  assert.match(sheet, /useKeyboardHeight\(\)/);
  assert.match(sheet, /Gesture\.Pan\(\)/);
  assert.match(sheet, /onRequestClose=\{onClose\}/);
  assert.match(sheet, /backgroundColor: resolvedAppearance === 'light'/);
  assert.match(sheet, /accessibilityLabel="Close"/);
});

test('feedback toast uses readable surface and text in both modes', () => {
  assert.match(toast, /useNativeAppearance\(\)/);
  assert.match(toast, /backgroundColor: palette\.bgDropdown, borderColor: palette\.borderDefault/);
  assert.match(toast, /color: palette\.textPrimary/);
  assert.match(toast, /color=\{palette\.textMuted\}/);
  assert.match(toast, /onHide/);
});

test('themed text field retains native input behaviours and overrides obsolete dark-only caller fills', () => {
  assert.match(field, /forwardRef<TextInput, TextInputProps>/);
  assert.match(field, /<TextInput\s*\{\.\.\.props\}\s*ref=\{ref\}/);
  assert.match(field, /style=\{\[\s*styles\.base,\s*style,\s*\{/);
  for (const prop of ['backgroundColor: palette.bgInput', 'borderColor: palette.borderDefault', 'color: palette.textPrimary']) {
    assert.ok(field.includes(prop), prop);
  }
  assert.match(field, /placeholderTextColor=\{placeholderTextColor \?\? palette\.textMuted\}/);
  assert.match(field, /selectionColor=\{selectionColor \?\? palette\.accent\}/);
  assert.match(field, /keyboardAppearance=\{keyboardAppearance \?\? resolvedAppearance\}/);
});

test('profile and location forms keep validation, API paths and theme-aware fields without weakening save gating', () => {
  for (const form of [location, profile]) {
    assert.match(form, /useNativeAppearance\(\)/);
    assert.match(form, /<ThemedTextField/);
    assert.doesNotMatch(form, /<TextInput\b/);
    assert.match(form, /color: palette\.textSecondary/);
    assert.match(form, /color: palette\.textMuted/);
    assert.match(form, /editable=\{!saving\}/);
    assert.match(form, /<BottomSheet visible onClose=\{handleDismiss\}/);
    assert.match(form, /apiClient\('\/users\/me'/);
  }
  assert.match(location, /location: trimmedLocation, postcode: trimmedPostcode/);
  assert.match(profile, /needsPhone/);
});

test('auction filter retains draft/apply contract, selectors and numeric keyboards in both modes', () => {
  assert.match(auction, /useNativeAppearance\(\)/);
  assert.equal((auction.match(/<ThemedTextField/g) || []).length, 7);
  assert.doesNotMatch(auction, /<TextInput\b/);
  assert.match(auction, /selected \? palette\.accent : palette\.textSecondary/);
  assert.match(auction, /backgroundColor: palette\.bgInput, borderColor: palette\.borderDefault/);
  assert.match(auction, /onApply\(draft\)/);
  assert.match(auction, /if \(visible\) setDraft\(value\)/);
  assert.match(auction, /keyboardType="number-pad"/);
  assert.match(auction, /countActiveAuctionFilters\(draft\)/);
});
