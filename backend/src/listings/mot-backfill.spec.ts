import { motEnrichmentUpdate } from './mot-backfill';
const listed = { vrm: 'AB21XYZ', make: 'FORD', year: 2021, model: null, motHistory: null };
const official = {
  dataSource: 'DVLA' as const, make: 'Ford', year: 2021, model: 'Focus',
  motHistory: [{ completedDate: '2025-06-01', testResult: 'PASSED' as const, motTestNumber: '1234567890' }],
};
describe('official retail MOT history recovery', () => {
  it('repopulates only authoritative MOT tests and missing models', () => {
    expect(motEnrichmentUpdate(listed, official)).toEqual({ motHistory: official.motHistory, model: 'Focus' });
  });
  it('never invents test history on a DVSA outage or an empty response', () => {
    expect(motEnrichmentUpdate(listed, { ...official, motHistory: undefined })).toBeNull();
    expect(motEnrichmentUpdate(listed, { ...official, motHistory: [] })).toBeNull();
  });
  it('rejects mismatched make and implausible model names', () => {
    expect(motEnrichmentUpdate(listed, { ...official, make: 'Toyota' })).toBeNull();
    expect(motEnrichmentUpdate(listed, { ...official, year: 2015 })).toBeNull();
    expect(motEnrichmentUpdate(listed, { ...official, model: 'undefined' })).toEqual({ motHistory: official.motHistory });
  });
  it('preserves seller-entered model and never adjusts advertised mileage or gearbox', () => {
    expect(motEnrichmentUpdate({ ...listed, model: 'Fiesta' }, official))
      .toEqual({ motHistory: official.motHistory });
  });
  it('rejects invalid test records rather than labelling an unchecked vehicle as tested', () => {
    expect(motEnrichmentUpdate(listed, { ...official, motHistory: [{completedDate:'',testResult:'PASSED' as const,motTestNumber:''}] })).toBeNull();
  });
});
