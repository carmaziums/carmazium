import { DvlaService } from './dvla.service';

describe('DvlaService AI specification enrichment', () => {
    const config = {
        get: jest.fn((key: string) => {
            if (key === 'DVLA_API_KEY') return 'dvla-test-key';
            if (key === 'MOT_API_KEY') return 'mot-test-key';
            return undefined;
        }),
    };

    const dvlaPayload = {
        registrationNumber: 'XGZ5459',
        make: 'TOYOTA',
        colour: 'BLACK',
        yearOfManufacture: 2022,
        engineCapacity: 2755,
        co2Emissions: 198,
        fuelType: 'DIESEL',
        motStatus: 'Valid',
        taxStatus: 'Taxed',
        typeApproval: 'M1',
        wheelplan: '2 AXLE RIGID BODY',
        monthOfFirstRegistration: '2022-03',
    };

    const motPayload = [{
        model: 'LAND CRUISER',
        primaryColour: 'BLACK',
        firstUsedDate: '2022-03-01',
        motTests: [],
    }];

    beforeEach(() => {
        jest.clearAllMocks();
        (global as any).fetch = jest.fn(async (url: string) => {
            if (String(url).includes('driver-vehicle-licensing.api.gov.uk')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => dvlaPayload,
                    text: async () => '',
                };
            }

            if (String(url).includes('check-mot.service.gov.uk')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => motPayload,
                    text: async () => '',
                };
            }

            throw new Error(`Unexpected URL: ${url}`);
        });
    });

    it('does not send registration data to AI enrichment without explicit consent', async () => {
        const aiService = {
            enrichVehicleSpecification: jest.fn().mockResolvedValue(null),
        };

        const service = new DvlaService(config as any, aiService as any);
        const result = await service.lookupVrm('XGZ5459');

        expect(result.make).toBe('TOYOTA');
        expect(result.model).toBe('LAND CRUISER');
        expect(aiService.enrichVehicleSpecification).not.toHaveBeenCalled();
        expect(result.specEnrichment).toBeUndefined();
    });

    it('auto-fills exact trim and technical specs only from strong exact-registration evidence', async () => {
        const aiService = {
            enrichVehicleSpecification: jest.fn().mockResolvedValue({
                variant: 'Invincible',
                transmission: 'AUTOMATIC',
                bodyType: 'SUV',
                driveType: '4WD',
                doors: 5,
                seats: 7,
                bhp: 201,
                engineDescription: '2.8 D-4D',
                confidence: 'HIGH',
                matchBasis: 'EXACT_REGISTRATION',
                evidenceCount: 2,
            }),
        };

        const service = new DvlaService(config as any, aiService as any);
        const result = await service.lookupVrm('XGZ5459', true);

        expect(aiService.enrichVehicleSpecification).toHaveBeenCalledWith(
            expect.objectContaining({
                vrm: 'XGZ5459',
                make: 'TOYOTA',
                model: 'LAND CRUISER',
                year: 2022,
                engineSize: 2755,
                fuelType: 'DIESEL',
            }),
        );

        expect(result).toEqual(expect.objectContaining({
            make: 'TOYOTA',
            model: 'LAND CRUISER',
            variant: 'Invincible',
            transmission: 'AUTOMATIC',
            bodyType: 'SUV',
            driveType: '4WD',
            doors: 5,
            seats: 7,
            bhp: 201,
            engineDescription: '2.8 D-4D',
        }));
        expect(result.specEnrichment).toEqual({
            confidence: 'HIGH',
            matchBasis: 'EXACT_REGISTRATION',
            evidenceCount: 2,
            source: 'AI_LIVE_WEB',
        });
    });

    it('uses strong profile consensus for non-identity specs but does not guess the exact trim', async () => {
        const aiService = {
            enrichVehicleSpecification: jest.fn().mockResolvedValue({
                variant: 'Invincible',
                transmission: 'AUTOMATIC',
                bodyType: 'SUV',
                driveType: '4WD',
                doors: 5,
                seats: 7,
                bhp: 201,
                engineDescription: '2.8 D-4D',
                confidence: 'MEDIUM',
                matchBasis: 'PROFILE_CONSENSUS',
                evidenceCount: 3,
            }),
        };

        const service = new DvlaService(config as any, aiService as any);
        const result = await service.lookupVrm('XGZ5459', true);

        expect(result.variant).toBeUndefined();
        expect(result.transmission).toBe('AUTOMATIC');
        expect(result.bodyType).toBe('SUV');
        expect(result.driveType).toBe('4WD');
        expect(result.seats).toBe(7);
        expect(result.bhp).toBe(201);
    });

    it('does not auto-fill uncertain AI specifications', async () => {
        const aiService = {
            enrichVehicleSpecification: jest.fn().mockResolvedValue({
                variant: 'Invincible',
                transmission: 'AUTOMATIC',
                bodyType: 'SUV',
                driveType: '4WD',
                doors: 5,
                seats: 7,
                bhp: 201,
                engineDescription: '2.8 D-4D',
                confidence: 'LOW',
                matchBasis: 'NONE',
                evidenceCount: 1,
            }),
        };

        const service = new DvlaService(config as any, aiService as any);
        const result = await service.lookupVrm('XGZ5459', true);

        expect(result.variant).toBeUndefined();
        expect(result.transmission).toBeUndefined();
        expect(result.bodyType).toBeUndefined();
        expect(result.driveType).toBeUndefined();
        expect(result.bhp).toBeUndefined();
        expect(result.specEnrichment?.confidence).toBe('LOW');
    });

    it('ignores an implausible MOT model instead of sending a year/make placeholder into valuation', async () => {
        (global as any).fetch = jest.fn(async (url: string) => {
            if (String(url).includes('driver-vehicle-licensing.api.gov.uk')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        ...dvlaPayload,
                        registrationNumber: 'AB14XYZ',
                        make: 'VAUXHALL',
                        yearOfManufacture: 2014,
                    }),
                    text: async () => '',
                };
            }

            if (String(url).includes('check-mot.service.gov.uk')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [{
                        model: '2014',
                        primaryColour: 'BLACK',
                        firstUsedDate: '2014-03-01',
                        motTests: [],
                    }],
                    text: async () => '',
                };
            }

            throw new Error(`Unexpected URL: ${url}`);
        });

        const aiService = {
            enrichVehicleSpecification: jest.fn().mockResolvedValue(null),
        };

        const service = new DvlaService(config as any, aiService as any);
        const result = await service.lookupVrm('AB14XYZ', true);

        expect(result.model).toBeUndefined();
        expect(aiService.enrichVehicleSpecification).toHaveBeenCalledWith(
            expect.objectContaining({
                make: 'VAUXHALL',
                model: undefined,
                year: 2014,
            }),
        );
    });
});
