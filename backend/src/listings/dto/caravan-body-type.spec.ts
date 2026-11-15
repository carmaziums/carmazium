import { BodyType } from './create-listing.dto';
import { ListingFilterDto } from './listing-filter.dto';
import { validateSync } from 'class-validator';

describe('Caravan body type validation', () => {
    it('is accepted by the shared auction and retail listing DTO', () => {
        expect(BodyType.CARAVAN).toBe('CARAVAN');
        expect(Object.values(BodyType)).toContain('CARAVAN');
    });

    it('can be selected as a search filter', () => {
        const filter = new ListingFilterDto();
        filter.bodyType = BodyType.CARAVAN;
        expect(validateSync(filter).filter(error => error.property === 'bodyType')).toEqual([]);
    });
});
