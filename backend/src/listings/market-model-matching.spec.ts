import { matchMarketplaceModel } from './market-model-matching';

describe('Block 5 model and derivative matching', () => {
    it('matches equivalent punctuation/manufacturer formatting exactly', () => {
        expect(matchMarketplaceModel(
            { make: 'Nissan', model: 'Nissan X-TRAIL E-POWER' },
            { model: 'X Trail', title: 'Nissan X-Trail used' },
        )).toBe('EXACT_MODEL');
        expect(matchMarketplaceModel(
            { make: 'VW', model: 'Volkswagen Golf' },
            { model: 'Golf', title: '2018 Volkswagen Golf' },
        )).toBe('EXACT_MODEL');
    });

    it('keeps generation-only aliases provisional while rejecting different generations', () => {
        const kia = { make: 'Kia', model: 'Sportage3' };
        expect(matchMarketplaceModel(kia, {
            model: 'Sportage', title: '2018 Kia Sportage 1.6',
        })).toBe('FAMILY_ONLY');
        expect(matchMarketplaceModel(kia, {
            model: 'Sportage2', title: '2018 Kia Sportage 3',
        })).toBeNull();
    });

    it('marks limited typo recovery as provisional, never merging different numeric models', () => {
        expect(matchMarketplaceModel(
            { make: 'Chery', model: 'Chery Tigga 4' },
            { model: 'Tiggo 4', title: '2026 Chery Tiggo 4 Aspire' },
        )).toBe('TYPO_RECOVERY');
        expect(matchMarketplaceModel(
            { make: 'Audi', model: 'A1' },
            { model: 'A3', title: '2018 Audi A1 SPORT' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Audi', model: 'A1' },
            { model: 'A10', title: '2018 Audi A1 SPORT' },
        )).toBeNull();
    });

    it('rejects generic Fiesta/Focus and Golf when the source is a performance model', () => {
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta' },
            { model: 'Fiesta ST', title: '2021 Ford Fiesta ST' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta' },
            { model: 'Fiesta', title: '2021 Ford Fiesta ST 1.5 EcoBoost' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Volkswagen', model: 'Golf' },
            { model: 'Golf', title: '2019 Volkswagen Golf GTI' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta', variant: 'ST' },
            { model: 'Fiesta', variant: 'ST-Line', title: '2021 Ford Fiesta ST-Line' },
        )).toBeNull();
    });

    it('does not use a contradictory model field even if the title contains the target', () => {
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Transit Connect' },
            { model: 'Connect', title: 'Ford Transit Connect' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta ST' },
            { model: 'Fiesta', title: '2020 Ford Fiesta ST' },
        )).toBeNull();
    });

    it('uses the full title provisionally only when the model field is absent', () => {
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta' },
            { model: '', title: '2021 Ford Fiesta 1.0 EcoBoost' },
        )).toBe('TITLE_ONLY');
        expect(matchMarketplaceModel(
            { make: 'Ford', model: 'Fiesta' },
            { model: '', title: '2021 Ford Fiesta ST' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Audi', model: 'A1' },
            { model: '', title: '2018 Audi A10' },
        )).toBeNull();
        expect(matchMarketplaceModel(
            { make: 'Mini', model: 'KP23TOH' },
            { model: 'Countryman', title: '2023 MINI Countryman' },
        )).toBeNull();
    });
});
