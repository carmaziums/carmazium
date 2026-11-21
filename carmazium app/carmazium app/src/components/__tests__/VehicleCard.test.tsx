/**
 * VehicleCard carousel regression tests.
 *
 * VehicleCard delegates paging to native ImageCarousel, which displays dots
 * for 2–5 images and an N/M counter for larger galleries (as on the website).
 * It loads the current and next image, rather than eagerly prefetching the
 * first three images on every card in a long scrolling vehicle grid.
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

    // A single photo is immediately visible, with no pagination controls.
    getByTestId('carousel-image');
  });

  it('renders indicator dots when card has 2 images', () => {
    const listing = makeListing(2);
    const { getByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    getByTestId('carousel-dots');
  });

  it('renders 5 dots for exactly 5 images', () => {
    const listing = makeListing(5);
    const { getAllByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    expect(getAllByTestId('carousel-dot')).toHaveLength(5);
  });

  it('shows a 1 / N counter instead of dots for galleries larger than five', () => {
    const listing = makeListing(7);
    const { getByTestId, queryAllByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );
    expect(getByTestId('carousel-counter').props.accessibilityLabel).toBe('Photo 1 of 7');
    expect(queryAllByTestId('carousel-dot')).toHaveLength(0);
  });

  it('renders active dot at index 0 on mount', () => {
    const listing = makeListing(3);
    const { getAllByTestId } = render(
      <VehicleCard listing={listing} onPress={() => {}} />,
    );

    const dots = getAllByTestId('carousel-dot');
    expect(dots[0].props.accessibilityState?.selected).toBe(true);
  });

  it('renders only the current and adjacent images instead of eager prefetching each card', () => {
    const listing = makeListing(5);
    const { Image } = require('expo-image');
    const { getAllByTestId } = render(<VehicleCard listing={listing} onPress={() => {}} />);

    // Avoid flooding the network when many marketplace cards are visible.
    expect(Image.prefetch).not.toHaveBeenCalled();
    expect(getAllByTestId('carousel-image')).toHaveLength(2);
  });
});
