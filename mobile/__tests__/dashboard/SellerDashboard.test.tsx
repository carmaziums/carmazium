import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// Mock API modules
jest.mock('@/lib/api', () => ({
  dashboardApi: {
    seller: jest.fn(),
  },
  offersApi: {
    respond: jest.fn(),
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

// Import after mocks
import SellerDashboard from '../../app/dashboard/seller/index';

const mockOfferData = {
  activeListings: 3,
  offerCount: 2,
  enquiries: 7,
  offers: [
    {
      id: 'o1',
      buyer: { firstName: 'Jane', lastName: 'Doe' },
      listing: { title: 'BMW 3 Series' },
      amount: 18000,
      status: 'PENDING',
    },
  ],
  earnings: [],
};

const mockMutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useQuery as jest.Mock).mockReturnValue({
    data: mockOfferData,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  });
  (useMutation as jest.Mock).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
});

describe('SellerDashboard', () => {
  describe('Overview KPI tiles (SELL-DASH-01)', () => {
    it('renders Active Listings KPI tile label', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Active Listings')).toBeTruthy();
    });

    it('renders Offers KPI tile label', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Offers')).toBeTruthy();
    });

    it('renders Enquiries KPI tile label', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Enquiries')).toBeTruthy();
    });
  });

  describe('Offer inbox (SELL-DASH-02, SELL-DASH-03)', () => {
    it('renders buyer name in offer row', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Jane Doe')).toBeTruthy();
    });

    it('renders formatted offer amount', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('£18,000')).toBeTruthy();
    });

    it('renders Accept button', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Accept')).toBeTruthy();
    });

    it('renders Decline button', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Decline')).toBeTruthy();
    });

    it('renders Counter button', () => {
      render(<SellerDashboard />);
      expect(screen.getByText('Counter')).toBeTruthy();
    });

    it('calls mutate with accept action when Accept is pressed', () => {
      render(<SellerDashboard />);
      fireEvent.press(screen.getByText('Accept'));
      expect(mockMutate).toHaveBeenCalledWith({ id: 'o1', action: 'accept', counterAmount: undefined });
    });

    it('calls mutate with reject action when Decline is pressed', () => {
      render(<SellerDashboard />);
      fireEvent.press(screen.getByText('Decline'));
      expect(mockMutate).toHaveBeenCalledWith({ id: 'o1', action: 'reject', counterAmount: undefined });
    });

    it('shows "No offers yet" when offers array is empty', () => {
      (useQuery as jest.Mock).mockReturnValue({
        data: { ...mockOfferData, offers: [] },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
      });
      render(<SellerDashboard />);
      expect(screen.getByText('No offers yet')).toBeTruthy();
    });
  });

  describe('Earnings summary (SELL-DASH-04)', () => {
    it('renders earnings summary with sold price, fee, and net', () => {
      (useQuery as jest.Mock).mockReturnValueOnce({
        data: {
          activeListings: 1,
          offerCount: 0,
          enquiries: 0,
          offers: [],
          earnings: [
            {
              id: 'e1',
              listing: { title: 'VW Golf' },
              soldPrice: 12000,
              platformFee: 240,
              net: 11760,
            },
          ],
        },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
      });
      const { getByText } = render(<SellerDashboard />);
      expect(getByText(/VW Golf/)).toBeTruthy();
      expect(getByText(/12,000/)).toBeTruthy();
      expect(getByText(/11,760/)).toBeTruthy();
    });
  });
});
