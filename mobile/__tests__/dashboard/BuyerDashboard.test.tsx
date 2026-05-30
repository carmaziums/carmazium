import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useSafeAreaInsets: () => ({ top: 0 }),
}));

// Mock react-native-safe-area-context (used by CzScreen)
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Mock react-native-reanimated (used by CzBadge)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock @tanstack/react-query
const mockRefetch = jest.fn();
const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => mockUseQuery(opts),
}));

// Mock the dashboard API
jest.mock('@/lib/api', () => ({
  dashboardApi: {
    buyer: jest.fn(),
  },
}));

// Import the screen AFTER all mocks are set up
import BuyerDashboard from '../../app/dashboard/buyer/index';

describe('BuyerDashboard overview screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('data state', () => {
    beforeEach(() => {
      mockUseQuery.mockReturnValue({
        data: { activeBids: 2, activeOffers: 1, watchlistCount: 5, wonAuctions: 0 },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      });
    });

    it('renders "Active Bids" KPI tile label', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('Active Bids')).toBeTruthy();
    });

    it('renders "Active Offers" KPI tile label', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('Active Offers')).toBeTruthy();
    });

    it('renders "Watchlist" KPI tile label', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('Watchlist')).toBeTruthy();
    });

    it('renders "Won" KPI tile label', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('Won')).toBeTruthy();
    });

    it('renders activeBids value', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('renders activeOffers value', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('renders watchlistCount value', () => {
      render(<BuyerDashboard />);
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('uses query key [dashboard, buyer]', () => {
      render(<BuyerDashboard />);
      const callArg = mockUseQuery.mock.calls[0][0];
      expect(callArg.queryKey).toEqual(['dashboard', 'buyer']);
    });
  });

  describe('loading state', () => {
    it('shows ActivityIndicator when isLoading is true', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      });
      const { toJSON } = render(<BuyerDashboard />);
      const tree = JSON.stringify(toJSON());
      // ActivityIndicator renders as 'ActivityIndicator' type
      expect(tree).toContain('ActivityIndicator');
    });
  });

  describe('error state', () => {
    it('shows error message when isError is true', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
        isRefetching: false,
      });
      render(<BuyerDashboard />);
      expect(screen.getByText('Could not load dashboard')).toBeTruthy();
    });
  });
});
