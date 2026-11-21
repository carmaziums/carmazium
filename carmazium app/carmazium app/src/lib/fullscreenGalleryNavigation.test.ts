import {
  clampPhotoIndex, getNextFullscreenPhotoIndex,
  fullscreenPhotoCounter, fullscreenPhotoAccessibilityLabel,
} from './fullscreenGalleryNavigation';

const photo = (translationX: number, currentIndex = 2, zoomScale = 1, velocityX = 0, photoCount = 10) =>
  getNextFullscreenPhotoIndex({ translationX, currentIndex, zoomScale, velocityX, photoCount, viewportWidth: 420 });

describe('full-screen photo swipe behaviour', () => {
  test('left swipe advances one photo; right swipe goes back', () => {
    expect(photo(-320)).toBe(3);
    expect(photo(320)).toBe(1);
  });
  test('short gestures do not switch photos', () => {
    expect(photo(-30)).toBe(2);
    expect(photo(30)).toBe(2);
  });
  test('deliberate high-velocity flick advances at short distance', () => {
    expect(photo(-36, 2, 1, -900)).toBe(3);
    expect(photo(36, 2, 1, 900)).toBe(1);
  });
  test('zoomed picture can pan in any direction without changing photo', () => {
    expect(photo(-350, 2, 2)).toBe(2);
    expect(photo(350, 2, 3)).toBe(2);
  });
  test('stays on first/last photo at edges', () => {
    expect(photo(320, 0)).toBe(0);
    expect(photo(-320, 9)).toBe(9);
  });
  test('works with a single photo or empty gallery', () => {
    expect(photo(-320, 0, 1, 0, 1)).toBe(0);
    expect(photo(-320, 0, 1, 0, 0)).toBe(0);
  });
  test('current photo index cannot leave the gallery range', () => {
    expect(clampPhotoIndex(40, 10)).toBe(9);
    expect(clampPhotoIndex(-3, 10)).toBe(0);
    expect(clampPhotoIndex(2, 10)).toBe(2);
  });
  test('photo counts are visible and accessible, including after swipe', () => {
    expect(fullscreenPhotoCounter(0, 10)).toBe('1 / 10');
    expect(fullscreenPhotoCounter(photo(-320, 0), 10)).toBe('2 / 10');
    expect(fullscreenPhotoAccessibilityLabel(1, 10)).toBe('Photo 2 of 10');
    expect(fullscreenPhotoCounter(0, 0)).toBe('0 / 0');
  });
});
