import { buildFeatureConditions } from './feature-search';

describe('vehicle feature search', () => {
  it('matches legacy navigation labels', () => {
    const conditions = buildFeatureConditions(['Navigation']);
    expect(conditions).toContainEqual({
      OR: expect.arrayContaining([
        { features: { array_contains: ['Navigation'] } },
        { features: { array_contains: ['Sat Nav'] } },
      ]),
    });
  });
  it('requires each requested feature separately', () => {
    const conditions = buildFeatureConditions(['Navigation', 'Heated Seats']);
    expect(conditions).toHaveLength(2);
    expect(conditions[0].OR).toEqual(expect.arrayContaining([{ features: { array_contains: ['Sat Nav'] } }]));
    expect(conditions[1].OR).toEqual(expect.arrayContaining([{ features: { array_contains: ['Heated Front Seats'] } }]));
  });
  it('does not equate front-only with rear-only parking sensors', () => {
    const [front] = buildFeatureConditions(['Front Parking Sensors']);
    expect(front.OR).not.toContainEqual({ features: { array_contains: ['Parking Sensors (Rear)'] } });
  });
});
