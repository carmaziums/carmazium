import { LiveMarketAttemptBroker, liveMarketTimeoutMs } from './live-market-attempt-broker';

const audi = {
    make: 'Audi', model: 'Audi A1', year: 2018, mileage: 106470,
    variant: 'Sport', fuelType: 'Petrol', transmission: 'Manual',
    writeOffCategory: 'NONE',
};
const market = {
    comparables: [{ price: 7850, year: 2018, mileage: 106470, kind: 'ACTIVE_ASK' as const }],
    checkedAt: '2026-10-02T12:00:00.000Z',
    rawComparableCount: 1,
    sourceDomains: ['example-dealer.co.uk'],
};

describe('Block 4 live-market attempt broker', () => {
    it('coalesces simultaneous identical attempts without retaining public evidence', async () => {
        const broker = new LiveMarketAttemptBroker();
        let finish!: (value: typeof market) => void;
        const deferred = new Promise<typeof market>((resolve) => { finish = resolve; });
        const search = jest.fn(() => deferred);
        const first = broker.run(audi, 'LIVE', 1, search);
        const second = broker.run({ ...audi, model: 'A1' }, 'LIVE', 1, search);
        finish(market);
        const responses = await Promise.all([first, second]);
        expect(search).toHaveBeenCalledTimes(1);
        expect(responses.map((r) => r.origin)).toEqual(['NETWORK', 'COALESCED']);
        expect(responses.map((r) => r.result)).toEqual([market, market]);
        await broker.run(audi, 'LIVE', 1, search);
        expect(search).toHaveBeenCalledTimes(2);
        expect(broker.snapshotCounters()).toEqual({
            network: 2, coalesced: 1, shortCache: 0,
        });
    });

    it('keeps all five LIVE and BLENDED plans independent', async () => {
        const broker = new LiveMarketAttemptBroker();
        const search = jest.fn().mockResolvedValue(market);
        const inputs: Promise<unknown>[] = [];
        for (let attempt = 1; attempt <= 5; attempt++) {
            inputs.push(broker.run(audi, 'LIVE', attempt, search));
            inputs.push(broker.run(audi, 'BLENDED', attempt, search));
        }
        await Promise.all(inputs);
        expect(search).toHaveBeenCalledTimes(10);
    });

    it('never shares different variants, generations, transmission or mileage', async () => {
        const broker = new LiveMarketAttemptBroker();
        const search = jest.fn().mockResolvedValue(market);
        await Promise.all([
            broker.run(audi, 'LIVE', 1, search),
            broker.run({ ...audi, model: 'A1 Sportback' }, 'LIVE', 1, search),
            broker.run({ ...audi, variant: 'S Line' }, 'LIVE', 1, search),
            broker.run({ ...audi, transmission: 'Automatic' }, 'LIVE', 1, search),
            broker.run({ ...audi, mileage: 20000 }, 'LIVE', 1, search),
        ]);
        expect(search).toHaveBeenCalledTimes(5);
    });

    it('only retains positive, sanitised advert results with an explicit rights switch', async () => {
        let now = 100;
        const broker = new LiveMarketAttemptBroker(() => now);
        const search = jest.fn().mockResolvedValue(market);
        expect((await broker.run(audi, 'LIVE', 1, search, true)).origin).toBe('NETWORK');
        expect((await broker.run(audi, 'LIVE', 1, search, true)).origin).toBe('SHORT_CACHE');
        expect(search).toHaveBeenCalledTimes(1);
        // A caller with caching disabled must never use prior stored results.
        expect((await broker.run(audi, 'LIVE', 1, search, false)).origin).toBe('NETWORK');
        expect(search).toHaveBeenCalledTimes(2);
        now += 61_000;
        expect((await broker.run(audi, 'LIVE', 1, search, true)).origin).toBe('NETWORK');
        expect(search).toHaveBeenCalledTimes(3);
    });

    it('does not cache empty results or failures and cleans up failed in-flight requests', async () => {
        const broker = new LiveMarketAttemptBroker();
        const search = jest.fn()
            .mockResolvedValueOnce({ ...market, comparables: [] })
            .mockRejectedValueOnce(new Error('provider timeout'))
            .mockResolvedValueOnce(market);
        expect((await broker.run(audi, 'LIVE', 1, search, true)).result?.comparables).toEqual([]);
        await expect(broker.run(audi, 'LIVE', 1, search, true)).rejects.toThrow('provider timeout');
        expect((await broker.run(audi, 'LIVE', 1, search, true)).result).toEqual(market);
        expect(search).toHaveBeenCalledTimes(3);
    });

    it('enforces a bounded configurable per-attempt timeout', () => {
        expect(liveMarketTimeoutMs()).toBe(18_000);
        expect(liveMarketTimeoutMs('NaN')).toBe(18_000);
        expect(liveMarketTimeoutMs('-1')).toBe(10_000);
        expect(liveMarketTimeoutMs('999999')).toBe(22_000);
        expect(liveMarketTimeoutMs('15000')).toBe(15_000);
    });
});
