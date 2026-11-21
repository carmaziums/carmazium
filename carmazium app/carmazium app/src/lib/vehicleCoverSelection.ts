import { apiClient } from './apiClient';
import { parseVehicleImageMetadata } from './vehicleImageMetadata';

export interface VehicleCoverRecommendation {
  recommendedIndex: number | null;
  confidence: number;
  view: 'front' | 'front_three_quarter' | 'side' | 'rear' | 'interior' | 'detail' | 'damage' | 'other' | 'unknown';
  reason: string;
}

/** Preserve the server/user order across category tabs, additions and removals. */
export function orderedVehicleImages(images: string[], order: string[]): string[] {
  const bySource = new Map(images.map(url => [parseVehicleImageMetadata(url).src, url]));
  const result: string[] = [];
  for (const url of [...order, ...images]) {
    const source = parseVehicleImageMetadata(url).src;
    const current = bySource.get(source);
    if (current) { result.push(current); bySource.delete(source); }
  }
  return result;
}

export async function recommendVehicleCoverPhoto(imageUrls: string[]): Promise<VehicleCoverRecommendation> {
  const result = await apiClient<{data: VehicleCoverRecommendation}>('/listings/photo-cover-recommendation', {
    method: 'POST',
    body: JSON.stringify({imageUrls}),
    timeoutMs: 30000,
  });
  return result.data;
}

/** Same candidate limit, confidence threshold and fallback as the web uploader. */
export async function selectAutomaticVehicleCover(images: string[]): Promise<{images: string[]; message: string}> {
  if (images.length < 2) return {images, message: ''};
  const candidates = images.slice(0, 30);
  try {
    const recommendation = await recommendVehicleCoverPhoto(candidates.map(url => parseVehicleImageMetadata(url).src));
    const index = recommendation?.recommendedIndex;
    if (Number.isFinite(recommendation?.confidence) && recommendation.confidence >= 0.6
        && Number.isInteger(index) && index !== null && index >= 0 && index < candidates.length) {
      if (index === 0) return {images, message: 'Your current first photo is already the best front cover.'};
      const next = [...images];
      const [cover] = next.splice(index, 1);
      next.unshift(cover);
      return {images: next, message: recommendation.view === 'front'
        ? 'Front photo selected automatically as the cover.'
        : 'Best front-angle photo selected automatically as the cover.'};
    }
    return {images, message: 'No clear front photo was found. You can choose the cover manually below.'};
  } catch {
    return {images, message: 'Photos uploaded. You can choose the cover manually below.'};
  }
}
