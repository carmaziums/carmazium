import { getListingSubmissionMissingFields } from './listing-readiness';
import { BodyType, CreateListingDto } from './dto/create-listing.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Manual touring caravan listing readiness', () => {
  const minimal = {
    bodyType: 'CARAVAN',
    vehicleType: 'CAR',
    title: 'Swift touring caravan for sale',
    location: 'Birmingham',
    images: ['https://example.test/caravan.jpg'],
    price: 6900,
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    partnerDistributionAcceptedAt: new Date(),
  };

  it('permits manually completed caravan adverts without VIN, VRM or car-only specifications', () => {
    expect(getListingSubmissionMissingFields(minimal)).toEqual([]);
  });

  it('does not require an invented registration, mileage or year in the listing DTO', async () => {
    const dto = plainToInstance(CreateListingDto, {
      ...minimal,
      listingType: 'CLASSIFIED',
      vrm: '',
    });
    const errors = await validate(dto, { skipMissingProperties: false });
    const keyErrors = errors.filter(e => ['vrm', 'mileage', 'year', 'vin', 'bodyType'].includes(e.property));
    expect(keyErrors).toEqual([]);
    expect(dto.bodyType).toBe(BodyType.CARAVAN);
  });

  it.each(['stolenRecovered', 'hasOutstandingFinance', 'isLegalRegisteredKeeper', 'partnerDistributionAcceptedAt'])('requires caravan seller safeguard %s', (field) => {
    expect(getListingSubmissionMissingFields({ ...minimal, [field]: null })).not.toEqual([]);
  });

  it('still rejects missing caravan title, location and photographs', () => {
    expect(getListingSubmissionMissingFields({
      ...minimal,
      title: '',
      location: '',
      images: [],
    })).toEqual(expect.arrayContaining(['title', 'location', 'at least one caravan photo']));
  });

  it('requires authority if a caravan seller explicitly declares they are not the keeper', () => {
    expect(getListingSubmissionMissingFields({
      ...minimal,
      isLegalRegisteredKeeper: false,
    })).toContain('authority to sell');
  });

  it('does not relax a motor vehicle’s standard required fields', () => {
    const missing = getListingSubmissionMissingFields({
      ...minimal,
      bodyType: 'HATCHBACK',
    });
    expect(missing).toEqual(expect.arrayContaining([
      'VRM', 'mileage', 'fuel type', 'transmission', 'at least 10 photos',
    ]));
  });
});
