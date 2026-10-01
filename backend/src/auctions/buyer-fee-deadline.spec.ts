import { BUYER_FEE_GRACE_MS, buyerFeeDeadlineAt } from './buyer-fee-deadline';
describe('authoritative buyer fee deadline', () => {
  const a = { status: 'ENDED', winnerId: 'buyer', buyerFeePaid: false, wonAt: '2026-10-01T10:00:00.000Z' };
  it('uses precisely 72h after the recorded win', () => {
    expect(BUYER_FEE_GRACE_MS).toBe(72 * 60 * 60 * 1000);
    expect(buyerFeeDeadlineAt(a)).toBe('2026-10-04T10:00:00.000Z');
  });
  it('does not charge winners with a paid or granted fee or invent missing deadlines', () => {
    expect(buyerFeeDeadlineAt({ ...a, buyerFeePaid: true })).toBeNull();
    expect(buyerFeeDeadlineAt({ ...a, winnerId: null })).toBeNull();
    expect(buyerFeeDeadlineAt({ ...a, wonAt: 'bad' })).toBeNull();
    expect(buyerFeeDeadlineAt({ ...a, wonAt: null })).toBeNull();
    expect(buyerFeeDeadlineAt({ ...a, status: 'CANCELLED' })).toBeNull();
  });
});
