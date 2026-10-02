const mockResponsesCreate = jest.fn();

jest.mock('openai', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        responses: {
            create: (...args: unknown[]) => mockResponsesCreate(...args),
        },
    })),
}));

import { searchLiveUkVehicleMarket } from './live-market-search';

describe('Block 4 OpenAI transport deadline', () => {
    const car = { make: 'AUDI', model: 'A1', year: 2018, mileage: 106470 };

    beforeEach(() => {
        mockResponsesCreate.mockReset();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('aborts a search that never responds, without retrying the same plan', async () => {
        mockResponsesCreate.mockImplementationOnce((_input, options) => new Promise(
            (_resolve, reject) => {
                options.signal.addEventListener('abort', () => {
                    const error = new Error('search deadline reached');
                    error.name = 'AbortError';
                    reject(error);
                }, { once: true });
            },
        ));
        const pending = searchLiveUkVehicleMarket(car, {
            apiKey: 'fake-test-key',
            model: 'test-model',
            timeoutMs: 60,
            phase: 'LIVE',
            attempt: 1,
        });
        // Install a handler before advancing fake time to avoid a transient
        // unhandled rejection from the simulated abort.
        const assertion = expect(pending).rejects.toThrow('search deadline reached');
        await jest.advanceTimersByTimeAsync(60);
        await assertion;
        expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
        expect(mockResponsesCreate.mock.calls[0][1].signal.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('clears the watchdog after a successful search', async () => {
        mockResponsesCreate.mockResolvedValueOnce({
            output_text: JSON.stringify({ comparables: [] }),
        });
        const result = await searchLiveUkVehicleMarket(car, {
            apiKey: 'fake-test-key',
            model: 'test-model',
            timeoutMs: 60,
            phase: 'LIVE',
            attempt: 2,
        });
        expect(result.comparables).toEqual([]);
        expect(result.rawComparableCount).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });
});
