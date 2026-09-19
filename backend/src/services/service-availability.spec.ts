import { ServiceType } from '@prisma/client';
import {
    parseLiveServiceFlag,
    serviceAcceptingNewRequests,
    serviceAvailabilitySnapshot,
} from './service-availability';

describe('TradeXchange service availability', () => {
    it('keeps core services live when a flag is omitted', () => {
        expect(parseLiveServiceFlag('TEST_FLAG')).toBe(true);
        expect(serviceAvailabilitySnapshot({} as NodeJS.ProcessEnv)).toEqual({
            DELIVERY: true,
            INSPECTION: true,
            FINANCE: true,
            WARRANTY: true,
        });
    });

    it('accepts explicit true and false values case-insensitively', () => {
        expect(parseLiveServiceFlag('TEST_FLAG', ' true ')).toBe(true);
        expect(parseLiveServiceFlag('TEST_FLAG', 'FALSE')).toBe(false);
    });

    it('rejects malformed values instead of silently enabling a service', () => {
        expect(() => parseLiveServiceFlag('TEST_FLAG', 'flase')).toThrow(/Invalid TEST_FLAG/);
        expect(() => parseLiveServiceFlag('TEST_FLAG', '1')).toThrow(/Invalid TEST_FLAG/);
    });

    it('reads each service from its matching environment variable', () => {
        const env = {
            NEXT_PUBLIC_FEATURE_DELIVERY: 'false',
            NEXT_PUBLIC_FEATURE_INSPECTION: 'true',
            NEXT_PUBLIC_FEATURE_FINANCE_SERVICES: 'false',
            NEXT_PUBLIC_FEATURE_WARRANTY: 'true',
        } as NodeJS.ProcessEnv;

        expect(serviceAcceptingNewRequests(ServiceType.DELIVERY, env)).toBe(false);
        expect(serviceAcceptingNewRequests(ServiceType.INSPECTION, env)).toBe(true);
        expect(serviceAcceptingNewRequests(ServiceType.FINANCE, env)).toBe(false);
        expect(serviceAcceptingNewRequests(ServiceType.WARRANTY, env)).toBe(true);
    });
});
