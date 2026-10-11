import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');

test('Home auction cards page one photo at a time and leave card information visible', () => {
  const home = read('screens/main/HomeScreen.tsx');
  const carousel = read('components/ImageCarousel.tsx');
  assert.equal((home.match(/<ImageCarousel images=\{images\} width=\{282\} height=\{150\} onPress=\{onPress\} indicatorBottom=\{72\}/g) || []).length, 2);
  assert.match(carousel, /horizontal\s+\n?\s*pagingEnabled/);
  assert.match(carousel, /initialNumToRender=\{1\}/);
  assert.match(carousel, /indicatorBottom\?: number/);
});

test('Auction details show listing photos, no fabricated stock image and a full-screen swipeable lightbox', () => {
  const auction = read('screens/vehicle/AuctionDetailScreen.tsx');
  const lightbox = read('components/ImageLightbox.tsx');
  assert.match(auction, /const galleryImages: string\[\]/);
  assert.match(auction, /<ImageCarousel[\s\S]{0,260}images=\{galleryImages\}/);
  assert.match(auction, /<ImageLightbox[\s\S]{0,240}initialIndex=\{galleryInitialIndex\}/);
  assert.doesNotMatch(auction, /images\.unsplash\.com\/photo-1617814076367/);
  assert.match(lightbox, /horizontal/);
  assert.match(lightbox, /pagingEnabled/);
});

test('Retail gallery retains pinch zoom and supports horizontal swipes with accessible arrows', () => {
  const retail = read('screens/vehicle/VehicleDetailScreen.tsx');
  assert.match(retail, /const pinchGesture = Gesture\.Pinch\(\)/);
  assert.match(retail, /runOnJS\(changeFullscreenPhoto\)/);
  assert.match(retail, /pinchScale\.value <= 1\.05/);
  assert.match(retail, /accessibilityLabel="Previous vehicle photo"/);
  assert.match(retail, /accessibilityLabel="Next vehicle photo"/);
});