import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL('../carmazium app/carmazium app/src/' + name, import.meta.url), 'utf8');

test('Settings pushes Saved Cars onto the main stack instead of replacing the Settings route with a tab', () => {
  const stack = read('navigation/MainStackNavigator.tsx');
  const settings = read('screens/main/SettingsScreen.tsx');
  assert.match(stack, /SavedCars:\s*undefined;/);
  assert.match(stack, /<Stack\.Screen\s+name="SavedCars"\s+component=\{SavedScreen\}/);
  assert.match(settings, /label: 'Saved Cars'[\s\S]{0,100}navigation\.navigate\('SavedCars'\)/);
});

test('Saved Cars exposes an accessible Back to Account Settings only when opened from settings; saved tab remains unchanged', () => {
  const saved = read('screens/main/SavedScreen.tsx');
  const tabs = read('navigation/TabNavigator.tsx');
  assert.match(saved, /openedFromSettings = route\.name === 'SavedCars'/);
  assert.match(saved, /\{openedFromSettings && \([\s\S]*?accessibilityLabel="Back to Account Settings"/);
  assert.match(saved, /onPress=\{\(\) => navigation\.goBack\(\)\}/);
  assert.match(tabs, /<Tab\.Screen name="Saved" component=\{SavedScreen\}/);
});