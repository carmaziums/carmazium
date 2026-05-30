import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { KpiTile } from '../../src/components/dashboard/KpiTile';
import { LeadFunnelBar } from '../../src/components/dashboard/LeadFunnelBar';

// Mock react-native-gifted-charts to avoid native module issues in tests
jest.mock('react-native-gifted-charts', () => ({ BarChart: () => null }));

describe('KpiTile', () => {
  it('renders numeric value formatted with toLocaleString en-GB', () => {
    render(<KpiTile label="Total Sales" value={1234} />);
    // 1234 formatted as en-GB is "1,234"
    expect(screen.getByText('1,234')).toBeTruthy();
  });

  it('renders string value as-is', () => {
    render(<KpiTile label="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders the label text', () => {
    render(<KpiTile label="Revenue" value={0} />);
    // In test env, className 'uppercase' is not applied — label renders as-is
    expect(screen.getByText('Revenue')).toBeTruthy();
  });

  it('renders without accent border by default (accent=false)', () => {
    const { toJSON } = render(<KpiTile label="Views" value={42} />);
    const tree = JSON.stringify(toJSON());
    // Should contain border-white/5 class (no accent)
    expect(tree).toContain('border-white/5');
  });

  it('renders accent border when accent=true', () => {
    const { toJSON } = render(<KpiTile label="Views" value={42} accent />);
    const tree = JSON.stringify(toJSON());
    // Should contain accent border class
    expect(tree).toContain('border-[#ff0037]/30');
  });
});

describe('LeadFunnelBar', () => {
  const zeroFunnel = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    NEGOTIATING: 0,
    WON: 0,
    LOST: 0,
  };

  const nonZeroFunnel = {
    NEW: 10,
    CONTACTED: 8,
    QUALIFIED: 5,
    NEGOTIATING: 3,
    WON: 2,
    LOST: 1,
  };

  it('does NOT throw when all funnel values are zero', () => {
    expect(() => render(<LeadFunnelBar funnel={zeroFunnel} />)).not.toThrow();
  });

  it('renders "No leads yet" empty state when all funnel values sum to 0', () => {
    render(<LeadFunnelBar funnel={zeroFunnel} />);
    expect(screen.getByText('No leads yet')).toBeTruthy();
  });

  it('does not render "No leads yet" when funnel has data', () => {
    render(<LeadFunnelBar funnel={nonZeroFunnel} />);
    expect(screen.queryByText('No leads yet')).toBeNull();
  });
});
