import { mergeOfficialVehicleData, normalizeOfficialVehicleData } from './official-vehicle-data';

describe('official DVLA/DVSA extra vehicle details', () => {
    it('keeps all bounded recognised values, including false and zero', () => {
        expect(normalizeOfficialVehicleData({
            dvla: {
                monthOfFirstDvlaRegistration: '2021-03',
                artEndDate: '2026-04-01',
                revenueWeight: 0,
                realDrivingEmissions: '1',
                automatedVehicle: false,
                apiKey: 'NEVER STORE THIS',
            },
            mot: {
                registrationDate: '2021-03-21',
                manufactureDate: '2021-02-18',
                secondaryColour: 'GREY',
                lastMotTestDate: '2026-02-01',
                motTestDueDate: '2027-02-01',
                vehicleId: 'NEVER STORE THIS',
            },
            vin: 'NEVER STORE THIS',
        })).toEqual({
            dvla: {
                monthOfFirstDvlaRegistration: '2021-03',
                artEndDate: '2026-04-01',
                revenueWeight: 0,
                realDrivingEmissions: '1',
                automatedVehicle: false,
            },
            mot: {
                registrationDate: '2021-03-21',
                manufactureDate: '2021-02-18',
                secondaryColour: 'GREY',
                lastMotTestDate: '2026-02-01',
                motTestDueDate: '2027-02-01',
            },
        });
    });

    it('preserves existing detail when a later API returns fewer fields', () => {
        expect(mergeOfficialVehicleData({
            dvla: { revenueWeight: 4000, automatedVehicle: false },
            mot: { secondaryColour: 'BLACK' },
        }, {
            dvla: { artEndDate: '2027-01-01' },
        })).toEqual({
            dvla: { revenueWeight: 4000, automatedVehicle: false, artEndDate: '2027-01-01' },
            mot: { secondaryColour: 'BLACK' },
        });
    });

    it('drops malformed, oversized or unknown fields', () => {
        expect(normalizeOfficialVehicleData({
            dvla: {
                revenueWeight: 9999999,
                realDrivingEmissions: 'x'.repeat(10000),
                automatedVehicle: 'false',
                arbitrary: { secret: 'x' },
            },
            mot: ['not a valid vehicle object'],
        })).toBeUndefined();
        expect(normalizeOfficialVehicleData(null)).toBeUndefined();
    });
});
