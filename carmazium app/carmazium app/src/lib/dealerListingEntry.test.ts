import {
  DEALER_LISTING_CHOICES, DEALER_LISTING_STEPS,
} from './dealerListingEntry';
import { orderedVehicleImages, selectAutomaticVehicleCover } from './vehicleCoverSelection';
import { apiClient } from './apiClient';

jest.mock('./apiClient', () => ({ apiClient: jest.fn() }));
const call = apiClient as jest.Mock;

beforeEach(() => call.mockReset());

test('new dealer listing always starts with an explicit Auction or Retail choice', () => {
  expect(DEALER_LISTING_CHOICES.map(x => x.method)).toEqual(['AUCTION', 'CLASSIFIED']);
  expect(DEALER_LISTING_CHOICES.map(x => x.action)).toEqual(['List for Auction', 'Start Listing']);
  expect(DEALER_LISTING_CHOICES[0].benefits).toContain('Free to list');
  expect(DEALER_LISTING_CHOICES[1].benefits).toContain('Starting from £1');
  expect(DEALER_LISTING_STEPS.map(x => x.title)).toEqual(['Details', 'Media', 'Pricing', 'Review']);
});

test('photo selection uses exact website recommendation endpoint and moves high-confidence cover to first', async () => {
  call.mockResolvedValueOnce({ data: { recommendedIndex: 1, confidence: 0.86, view: 'front', reason: 'Front angle' } });
  const selected = await selectAutomaticVehicleCover(['side.jpg', 'front.jpg', 'rear.jpg']);
  expect(selected.images).toEqual(['front.jpg', 'side.jpg', 'rear.jpg']);
  expect(selected.message).toBe('Front photo selected automatically as the cover.');
  expect(call.mock.calls[0][0]).toBe('/listings/photo-cover-recommendation');
  expect(call.mock.calls[0][1].method).toBe('POST');
  expect(JSON.parse(call.mock.calls[0][1].body).imageUrls).toHaveLength(3);
});

test('cover selection keeps original order when the recommendation is weak', async () => {
  call.mockResolvedValueOnce({ data: { recommendedIndex: 1, confidence: 0.59, view: 'front', reason: 'Unclear' } });
  const selected = await selectAutomaticVehicleCover(['one.jpg', 'two.jpg']);
  expect(selected.images).toEqual(['one.jpg', 'two.jpg']);
});

test('cover selection sends at most 30 candidates and preserves remaining photos', async () => {
  const images = Array.from({ length: 34 }, (_, i) => `photo-${i}.jpg`);
  call.mockResolvedValueOnce({ data: { recommendedIndex: 5, confidence: 0.95, view: 'front_three_quarter', reason: 'Best angle' } });
  const selected = await selectAutomaticVehicleCover(images);
  expect(selected.images[0]).toBe('photo-5.jpg');
  expect(selected.images).toHaveLength(34);
  expect(JSON.parse(call.mock.calls[0][1].body).imageUrls).toHaveLength(30);
  expect(selected.images.includes('photo-33.jpg')).toBe(true);
});

test('server/user photo ordering retains all images without duplicates', () => {
  expect(orderedVehicleImages(['side.jpg', 'front.jpg'], ['front.jpg', 'side.jpg']))
    .toEqual(['front.jpg', 'side.jpg']);
});
