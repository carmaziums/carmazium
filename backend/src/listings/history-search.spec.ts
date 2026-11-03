import { applyHistoryFilters } from './history-search';

describe('history / status search filters', () => {
  it('combines door and seat maximums with existing minimums', () => {
    const where: any = { doors: { gte: 3 }, seats: { gte: 5 } };
    applyHistoryFilters(where, { maxDoors: 5, maxSeats: 7 });
    expect(where.doors).toEqual({ gte: 3, lte: 5 });
    expect(where.seats).toEqual({ gte: 5, lte: 7 });
  });
  it('matches saved MOT and tax snapshot values', () => {
    const where: any = {};
    applyHistoryFilters(where, { motValid: true, taxedOnly: true });
    expect(where.motStatus).toEqual({ equals: 'Valid', mode: 'insensitive' });
    expect(where.taxStatus).toEqual({ equals: 'Taxed', mode: 'insensitive' });
  });
  it('maps service history levels including legacy spellings', () => {
    const where: any = {};
    applyHistoryFilters(where, { serviceHistories: ['PARTIAL', 'NONE'] });
    expect(where.serviceHistory.in).toEqual(expect.arrayContaining(['Partial', 'Part', 'None', 'NONE']));
    expect(where.serviceHistory.in).not.toContain('Full Main Dealer');
  });
  it('limits previous keepers, treating 5 as 5 or more', () => {
    const two: any = {};
    applyHistoryFilters(two, { maxOwners: 2 });
    expect(two.owners).toEqual({ in: ['1', '2'] });
    const five: any = {};
    applyHistoryFilters(five, { maxOwners: 5 });
    expect(five.owners.in).toEqual(expect.arrayContaining(['1', '4', '5+']));
  });
  it('adds nothing when no filter is set', () => {
    const where: any = { status: 'ACTIVE' };
    applyHistoryFilters(where, {});
    expect(where).toEqual({ status: 'ACTIVE' });
  });
});
