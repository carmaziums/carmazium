import type { CarListing } from '../data/listings';

/**
 * Present the actual gearbox reported by the listing API.
 *
 * Never silently turn an unrecognised, absent, CVT or semi-automatic value into
 * "Automatic": buyers rely on this distinction before viewing or bidding.
 * Handles both API enum values and previously formatted card values.
 */
export function formatTransmission(raw?: string | null): CarListing['transmission'] {
  const code = String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  switch (code) {
    case 'MANUAL': return 'Manual';
    case 'AUTO':
    case 'AUTOMATIC': return 'Automatic';
    case 'SEMI_AUTO':
    case 'SEMI_AUTOMATIC':
    case 'SEMIAUTOMATIC': return 'Semi-Automatic';
    case 'CVT':
    case 'CONTINUOUSLY_VARIABLE': return 'CVT';
    default: return 'Not specified';
  }
}
