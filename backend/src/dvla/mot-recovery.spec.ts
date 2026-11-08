import { DvlaService } from './dvla.service';
import { ListingsService } from '../listings/listings.service';
const config = (extra = {}) => ({ get: (key: string) => ({ DVLA_API_KEY: 'test', MOT_HISTORY_API_KEY: 'test', MOT_HISTORY_CLIENT_ID: 'test', MOT_HISTORY_CLIENT_SECRET: 'test', MOT_HISTORY_TOKEN_URL: 'https://login.microsoftonline.com/test/oauth2/v2.0/token', DVLA_MOT_TIMEOUT_MS: '40', ...extra } as any)[key] });
const history = [{ completedDate: '2026-01-01', testResult: 'PASSED', motTestNumber: '123' }];
const vehicle = { registration: 'AB17XYZ', make: 'LANDROVER', model: 'DISCOVERY', motTests: history };
const ok = (body: any) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, errorCode?: string) => ({ ok: false, status, json: async () => ({ errorCode }) });
let mot: jest.Mock, token: jest.Mock, core: jest.Mock;
const service = (extra = {}) => new DvlaService(config(extra) as any, {} as any);
beforeEach(() => {
 mot = jest.fn(async () => ok(vehicle)); token = jest.fn(async () => ok({ access_token: 'test', expires_in: 3600 }));
 core = jest.fn(async () => ok({ registrationNumber: 'AB17XYZ', make: 'LAND ROVER', yearOfManufacture: 2017 }));
 global.fetch = jest.fn((url: any) => String(url).includes('login.microsoftonline') ? token() : String(url).includes('history.mot.api') ? mot() : core()) as any;
});
afterEach(() => jest.restoreAllMocks());
it('triggers both sources and accepts equivalent make spacing', async () => {
 const result = await service().lookupVrm('AB17XYZ');
 expect(core).toHaveBeenCalledTimes(1); expect(mot).toHaveBeenCalledTimes(1);
 expect(result.motHistoryStatus).toBe('AVAILABLE'); expect(result.motHistory).toHaveLength(1);
});
it('retries MOT 503 without repeating DVLA or authentication', async () => {
 mot.mockResolvedValueOnce(fail(503));
 expect((await service().lookupVrm('AB17XYZ')).motHistoryStatus).toBe('AVAILABLE');
 expect(mot).toHaveBeenCalledTimes(2); expect(core).toHaveBeenCalledTimes(1); expect(token).toHaveBeenCalledTimes(1);
});
it('refreshes a rejected token once', async () => {
 mot.mockResolvedValueOnce(fail(401));
 expect((await service().lookupVrm('AB17XYZ')).motHistoryStatus).toBe('AVAILABLE');
 expect(token).toHaveBeenCalledTimes(2);
});
it('does not immediately retry rate limits or claim there are no tests', async () => {
 mot.mockResolvedValue(fail(429)); const result = await service().lookupVrm('AB17XYZ');
 expect(result.motHistoryFailure).toBe('RATE_LIMIT'); expect(result.motHistory).toBeUndefined(); expect(mot).toHaveBeenCalledTimes(1);
});
it('reports missing configuration with no secret values', async () => {
 const result = await service({ MOT_HISTORY_CLIENT_SECRET: undefined }).lookupVrm('AB17XYZ');
 expect(result.motHistoryFailure).toBe('CONFIGURATION'); expect(result.motHistory).toBeUndefined(); expect(mot).not.toHaveBeenCalled();
});
it('bounds a stalled MOT request and retries once', async () => {
 mot.mockImplementation(() => new Promise(() => {})); const result = await service().lookupVrm('AB17XYZ');
 expect(mot).toHaveBeenCalledTimes(2); expect(result.make).toBe('LAND ROVER'); expect(result.motHistoryFailure).toBe('TIMEOUT');
});
it('bounds a stalled shared token and permits a later fresh authentication', async () => {
 token.mockImplementation(() => new Promise(() => {})); const instance = service();
 expect((await instance.lookupVrm('AB17XYZ')).motHistoryFailure).toBe('TIMEOUT');
 const now = Date.now(); jest.spyOn(Date, 'now').mockReturnValue(now + 6000);
 token.mockResolvedValue(ok({ access_token: 'new-test', expires_in: 3600 }));
 expect((await instance.lookupVrm('AB17XYZ')).motHistoryStatus).toBe('AVAILABLE');
});
it('distinguishes a vehicle not found from an incorrect endpoint', async () => {
 mot.mockResolvedValue(fail(404, 'MOTH-NF-01'));
 expect((await service().lookupVrm('AB17XYZ')).motHistoryStatus).toBe('NO_TESTS');
 mot.mockResolvedValue(fail(404, 'MOTH-NF-02'));
 expect((await service().lookupVrm('AB17XYZ')).motHistoryStatus).toBe('UNAVAILABLE');
});
it('rejects another registration or make', async () => {
 for (const patch of [{ registration: 'XX17ZZZ' }, { make: 'FORD' }]) {
  mot.mockResolvedValue(ok({ ...vehicle, ...patch })); const result = await service().lookupVrm('AB17XYZ');
  expect(result.motHistoryStatus).toBe('IDENTITY_MISMATCH'); expect(result.motHistory).toBeUndefined();
 }
});

describe('listing recovery', () => {
 const listing = { id: 'one', type: 'CLASSIFIED', status: 'ACTIVE', vrm: 'AB17XYZ', make: 'LAND ROVER', year: 2017, model: 'Discovery', motHistory: null };
 const official = { vrm: 'AB17XYZ', make: 'LAND ROVER', year: 2017, motHistoryStatus: 'AVAILABLE', motHistory: history };
 let instance: any;
 const flush = () => new Promise(resolve => setImmediate(resolve));
 beforeEach(() => {
  instance = Object.create(ListingsService.prototype);
  Object.assign(instance, { config: { get: () => 'configured' }, dvlaService: { lookupVrm: jest.fn().mockResolvedValue(official) }, motBackfillAttempts: new Map(), motBackfillActive: 0, motBackfillNextAt: 0, prisma: { listing: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } }, logger: { warn: jest.fn() } });
 });
 it.each(['AUCTION', 'CLASSIFIED'])('recovers %s drafts with identity/lifecycle and empty-history guards', async type => {
  instance.backfillRetailMotOnView({ ...listing, type, status: 'DRAFT' }); await flush();
  const update = instance.prisma.listing.updateMany.mock.calls[0][0];
  expect(update.where).toMatchObject({ id: 'one', type, status: 'DRAFT', vrm: 'AB17XYZ', make: 'LAND ROVER', year: 2017, deletedAt: null });
  expect(update.where.OR).toHaveLength(3); expect(update.data).toEqual({ motHistory: history });
 });
 it.each(['SOLD', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'])('does not automatically modify %s records', async status => {
  instance.backfillRetailMotOnView({ ...listing, status }); await flush(); expect(instance.dvlaService.lookupVrm).not.toHaveBeenCalled();
 });
 it('preserves existing histories and deleted records', async () => {
  instance.backfillRetailMotOnView({ ...listing, motHistory: history }); instance.backfillRetailMotOnView({ ...listing, deletedAt: new Date() }); await flush();
  expect(instance.dvlaService.lookupVrm).not.toHaveBeenCalled();
 });
 it('retries outages after five minutes rather than a day', async () => {
  let now = 10000000; jest.spyOn(Date, 'now').mockImplementation(() => now);
  instance.dvlaService.lookupVrm.mockResolvedValue({ ...official, motHistory: undefined, motHistoryStatus: 'UNAVAILABLE' });
  instance.backfillRetailMotOnView(listing); await flush(); now += 60000; instance.backfillRetailMotOnView(listing); await flush();
  expect(instance.dvlaService.lookupVrm).toHaveBeenCalledTimes(1);
  now += 5 * 60000; instance.backfillRetailMotOnView(listing); await flush();
  expect(instance.dvlaService.lookupVrm).toHaveBeenCalledTimes(2); expect(instance.prisma.listing.updateMany).not.toHaveBeenCalled();
 });
 it('uses a day cooldown only for confirmed empty records', async () => {
  const now = 10000000; jest.spyOn(Date, 'now').mockReturnValue(now);
  instance.dvlaService.lookupVrm.mockResolvedValue({ ...official, motHistory: [], motHistoryStatus: 'NO_TESTS' }); instance.backfillRetailMotOnView(listing); await flush();
  expect(instance.motBackfillAttempts.get('one')).toBe(now + 24 * 60 * 60000); expect(instance.prisma.listing.updateMany).not.toHaveBeenCalled();
 });
});


it('reports TLS failure without retrying it or erasing successful DVLA data', async () => {
 const error = new TypeError('fetch failed');
 Object.assign(error, { cause: { code: 'ERR_SSL_TLSV1_UNRECOGNIZED_NAME' } });
 mot.mockRejectedValue(error);
 const result = await service().lookupVrm('AB17XYZ');
 expect(result.make).toBe('LAND ROVER');
 expect(result.motHistoryStatus).toBe('UNAVAILABLE');
 expect(result.motHistoryFailure).toBe('CONNECTION');
 expect(result.motHistoryCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
 expect(mot).toHaveBeenCalledTimes(1);
});
it.each(['MOTH-RL-01', 'MOTH-RL-02'])('retains safe quota detail %s without retrying', async code => {
 mot.mockResolvedValue(fail(429, code));
 const result = await service().lookupVrm('AB17XYZ');
 expect(result.motHistoryFailure).toBe('RATE_LIMIT');
 expect(result.motHistoryErrorCode).toBe(code);
 expect(mot).toHaveBeenCalledTimes(1);
});
it('does not expose arbitrary upstream error strings', async () => {
 mot.mockResolvedValue(fail(429, 'secret-response-body'));
 const result = await service().lookupVrm('AB17XYZ');
 expect(result.motHistoryErrorCode).toBeUndefined();
});
