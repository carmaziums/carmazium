import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock react-native-gifted-charts to avoid native module issues in tests
jest.mock('react-native-gifted-charts', () => ({ BarChart: () => null }));

// Mock expo-router
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

// Mock dashboard API to avoid AsyncStorage / Supabase native module chain
jest.mock('@/lib/api/dashboard', () => ({
  dashboardApi: { dealer: jest.fn() },
}));

// Mock @tanstack/react-query — useQuery returns nominal dealer data by default
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: {
      activeListings: 12,
      activeAuctions: 3,
      totalLeads: 8,
      soldThisMonth: 2,
      leadFunnel: {
        NEW: 3,
        CONTACTED: 2,
        QUALIFIED: 2,
        NEGOTIATING: 1,
        WON: 2,
        LOST: 0,
      },
      conversionRate: 0.25,
      avgViews: 47,
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  })),
}));

// eslint-disable-next-line import/first
import DealerDashboard from '../../app/dashboard/dealer/index';
// eslint-disable-next-line import/first
import { useQuery } from '@tanstack/react-query';

const mockUseQuery = useQuery as jest.Mock;

describe('DealerDashboard', () => {
  beforeEach(() => {
    mockUseQuery.mockClear();
  });

  it('renders "Active Listings" KPI tile label', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('Active Listings')).toBeTruthy();
  });

  it('renders "Auctions" KPI tile label', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('Auctions')).toBeTruthy();
  });

  it('renders "Leads" KPI tile label', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('Leads')).toBeTruthy();
  });

  it('renders "Sold / Mo" KPI tile label', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('Sold / Mo')).toBeTruthy();
  });

  it('renders "25.0%" for conversionRate 0.25', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('25.0%')).toBeTruthy();
  });

  it('renders "47" for avgViews', () => {
    render(<DealerDashboard />);
    expect(screen.getByText('47')).toBeTruthy();
  });

  it('shows "No leads yet" when all leadFunnel values are 0', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        activeListings: 0,
        activeAuctions: 0,
        totalLeads: 0,
        soldThisMonth: 0,
        leadFunnel: {
          NEW: 0,
          CONTACTED: 0,
          QUALIFIED: 0,
          NEGOTIATING: 0,
          WON: 0,
          LOST: 0,
        },
        conversionRate: 0,
        avgViews: 0,
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      isRefetching: false,
    });
    render(<DealerDashboard />);
    expect(screen.getByText('No leads yet')).toBeTruthy();
  });

  it('shows ActivityIndicator when isLoading is true', () => {
    mockUseQuery.mockReturnValueOnce({
      data: undefined as unknown as object,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
      isRefetching: false,
    });
    render(<DealerDashboard />);
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });
});
