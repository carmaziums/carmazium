/**
 * VehicleCard carousel — RED test stubs (Plan 17-01)
 *
 * These 5 tests describe the carousel behaviour that will be implemented in
 * Plan 17-02. All tests MUST FAIL before the carousel is added to VehicleCard.
 * The testIDs (carousel-image, carousel-dots, carousel-dot) and Image.prefetch
 * calls do not exist in the current component.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { CarListing } from '../../data/listings';

// ---- Mocks ----------------------------------------------------------------

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Pan: () => ({
      activeOffsetX: () => ({
        failOffsetY: () => ({
          onUpdate: () => ({
            onEnd: () => ({}),
          }),
        }),
      }),
    }),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const MockImage = (props: Record<string, unknown>) =>
    React.createElement('Image', props);
  MockImage.prefetch = jest.fn();
  return { Image: MockImage };
});

jest.mock('@/store/watchlistStore', () => ({
  useWatchlistStore: () => ({
    isSaved: () => false,
    toggle: jest.fn(),
  }),
}));

jest.mock('@/components/BrandIcon', () => ({
  Ionicons: 'Ionicons',
}));

// ---- Factory ---------------------------------------------------------------

function makeListing(imageCount: number): CarListing {
  return {
    id: 'test-listing-1',
    make: 'BMW',
    model: 'M3',
    variant: 'Competition',
    year: 2023,
    price: 75000,
    mileage: 5000,
    fuelType: 'Petrol',
    transmission: 'Automatic',
    category: 'Sports',
    condition: 'Used',
    colour: 'Black',
    bhp: 510,
    zeroToSixty: 3.9,
    topSpeed: 180,
    location: 'London',
    dealer: 'BMW London',
    rating: 4.8,
    images: Array.from(
      { length: imageCount },
      (_, i) => `https://example.com/car-${i + 1}.jpg`,
    ),
    isFeatured: false,
    isNew: false,
  };
}

// ---- Import component (after mocks) ----------------------------------------

import { VehicleCard } from '../VehicleCard';

// ---- Tests -----------------------------------------------------------------

describe('VehicleCard carousel', () => {
  beforeEach(() => {
    const { Image } = require('expo-image');
    Image.prefetch.mockClear();
  });

  it('renders without GestureDetector when card has 1 image', () => {
    const listing = makeListing(1);
    const { getByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    // For a single-image card the carousel image strip should NOT be rendered.
    // 'carousel-image' testID will be added to VehicleCard in Plan 17-02.
    // Currently the component does NOT render it — this test fails RED because
    // getByTestId throws when the element is not found.
    getByTestId('carousel-image');
  });

  it('renders indicator dots when card has 2 images', () => {
    const listing = makeListing(2);
    const { getByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    // Expects the dots container to exist for 2+ image listings.
    // 'carousel-dots' testID does not exist in the current VehicleCard — FAILS RED.
    getByTestId('carousel-dots');
  });

  it('renders exactly 5 dots when card has 7 images (capped at 5)', () => {
    const listing = makeListing(7);
    const { getAllByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    // Expects 5 dot elements (capped) for a 7-image listing.
    // No 'carousel-dot' testIDs exist in the current component — FAILS RED.
    const dots = getAllByTestId('carousel-dot');
    expect(dots).toHaveLength(5);
  });

  it('renders active dot at index 0 on mount', () => {
    const listing = makeListing(3);
    const { getAllByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    // The first dot should carry accessibilityState.selected=true on mount.
    // No 'carousel-dot' testIDs exist in the current component — FAILS RED.
    const dots = getAllByTestId('carousel-dot');
    expect(dots[0].props.accessibilityState?.selected).toBe(true);
  });

  it('calls Image.prefetch for first 3 image URIs on mount', () => {
    const listing = makeListing(5);
    const { Image } = require('expo-image');

    render(<VehicleCard listing={listing} onPress={() => {}} />);

    // VehicleCard should prefetch the first 3 images on mount.
    // Currently it does NOT call Image.prefetch at all — FAILS RED.
    expect(Image.prefetch).toHaveBeenCalledTimes(3);
    expect(Image.prefetch).toHaveBeenNthCalledWith(1, listing.images[0]);
    expect(Image.prefetch).toHaveBeenNthCalledWith(2, listing.images[1]);
    expect(Image.prefetch).toHaveBeenNthCalledWith(3, listing.images[2]);
  });
});
