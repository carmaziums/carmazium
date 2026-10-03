import { DvlaService } from './dvla.service';

describe('current DVSA MOT History v1 model lookup', () => {
    const values: Record<string, string> = {
        DVLA_API_KEY: 'dvla-test',
        MOT_API_KEY: 'legacy-only-test',
        MOT_HISTORY_API_KEY: 'v1-api-test',
        MOT_HISTORY_CLIENT_ID: 'oauth-client-test',
        MOT_HISTORY_CLIENT_SECRET: 'oauth-secret-test',
        MOT_HISTORY_SCOPE: 'https://tapi.dvsa.gov.uk/.default',
        MOT_HISTORY_TOKEN_URL: 'https://example.invalid/entra/token',
        MOT_HISTORY_API_URL: 'https://history.mot.api.gov.uk',
    };
    const config = { get: (key: string) => values[key] };
    const ai = { enrichVehicleSpecification: jest.fn() };

    function dvlaResponse() {
        return {
            ok: true, status: 200,
            json: async () => ({
                registrationNumber: 'AB18XYZ',
                make: 'HONDA',
                yearOfManufacture: 2018,
                fuelType: 'PETROL',
                motStatus: 'Valid',
            }),
        };
    }

    it('uses OAuth2 plus the v1 endpoint and returns an authoritative MOT model', async () => {
        let oauthCount = 0;
        const request = jest.fn(async (url: string, init: any) => {
            if (url.includes('driver-vehicle-licensing')) return dvlaResponse();
            if (url.includes('/entra/token')) {
                oauthCount += 1;
                expect(init.method).toBe('POST');
                expect(init.body).toContain('grant_type=client_credentials');
                return { ok: true, status: 200, json: async () => ({ access_token: 'oauth-token', expires_in: 3600 }) };
            }
            if (url.includes('history.mot.api.gov.uk')) {
                expect(init.headers.Authorization).toBe('Bearer oauth-token');
                expect(init.headers['X-API-Key']).toBe('v1-api-test');
                return {
                    ok: true, status: 200,
                    json: async () => ({
                        registration: 'AB18XYZ',
                        make: 'HONDA', model: 'JAZZ',
                        primaryColour: 'Blue', firstUsedDate: '2018-03-01',
                        motTests: [],
                    }),
                };
            }
            throw new Error('Unexpected request: ' + url);
        });
        (global as any).fetch = request;
        const service = new DvlaService(config as any, ai as any);
        const first = await service.lookupVrm('AB18XYZ');
        const next = await service.lookupVrm('AB18XYA');
        expect(first).toEqual(expect.objectContaining({
            make: 'HONDA', model: 'JAZZ', primaryColour: 'Blue',
        }));
        expect(next.model).toBe('JAZZ');
        expect(oauthCount).toBe(1);
        expect(request.mock.calls.some(([url]) => String(url).includes('beta.check-mot.service.gov.uk'))).toBe(false);
    });

    it('retains DVLA make/year and asks for model when optional MOT v1 is unauthorized', async () => {
        (global as any).fetch = jest.fn(async (url: string) => {
            if (url.includes('driver-vehicle-licensing')) return dvlaResponse();
            if (url.includes('/entra/token')) return {
                ok: true, status: 200,
                json: async () => ({ access_token: 'oauth-token', expires_in: 3600 }),
            };
            if (url.includes('history.mot.api.gov.uk')) return {
                ok: false, status: 401,
            };
            throw new Error('Unexpected request: ' + url);
        });
        const service = new DvlaService(config as any, ai as any);
        const result = await service.lookupVrm('AB18XYZ');
        expect(result.make).toBe('HONDA');
        expect(result.year).toBe(2018);
        expect(result.model).toBeUndefined();
    });
});
