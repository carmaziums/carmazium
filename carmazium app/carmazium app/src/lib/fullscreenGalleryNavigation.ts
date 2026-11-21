/**
 * Source of truth for native fullscreen vehicle-gallery navigation.
 * - A horizontal swipe changes photos at the normal zoom level.
 * - Zoomed photos pan freely instead of accidentally switching vehicles.
 * - Photo indices are always clamped so the gallery never displays a missing image.
 */
export type FullscreenSwipe = {
  currentIndex: number;
  photoCount: number;
  translationX: number;
  velocityX?: number;
  zoomScale: number;
  viewportWidth: number;
};

export function clampPhotoIndex(index: number, photoCount: number): number {
  const count = Number.isFinite(photoCount) ? Math.max(0, Math.floor(photoCount)) : 0;
  if (!count) return 0;
  return Math.min(count - 1, Math.max(0, Number.isFinite(index) ? Math.floor(index) : 0));
}

export function getNextFullscreenPhotoIndex({
  currentIndex, photoCount, translationX, velocityX = 0, zoomScale, viewportWidth,
}: FullscreenSwipe): number {
  const current = clampPhotoIndex(currentIndex, photoCount);
  if (photoCount <= 1 || !Number.isFinite(translationX) || !Number.isFinite(zoomScale)) return current;
  // When zoomed, dragging is panning, not changing the image.
  if (zoomScale > 1.05) return current;

  const threshold = Math.max(55, (Number.isFinite(viewportWidth) ? viewportWidth : 360) * 0.18);
  const isSwipe = Math.abs(translationX) >= threshold ||
    (Math.abs(translationX) > 24 && Number.isFinite(velocityX) && Math.abs(velocityX) >= 650);
  if (!isSwipe) return current;
  return clampPhotoIndex(current + (translationX < 0 ? 1 : -1), photoCount);
}

/** Screen reader and visible gallery count always use the *selected* photo index. */
export function fullscreenPhotoCounter(index: number, count: number): string {
  return count > 0 ? `${clampPhotoIndex(index, count) + 1} / ${count}` : '0 / 0';
}

export function fullscreenPhotoAccessibilityLabel(index: number, count: number): string {
  return count > 0 ? `Photo ${clampPhotoIndex(index, count) + 1} of ${count}` : 'No vehicle photos';
}
