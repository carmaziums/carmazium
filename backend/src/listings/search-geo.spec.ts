import { geoBounds, haversineMiles } from './search-geo';
describe('distance search calculations', () => {
  it('uses exact haversine distances even at zero coordinates', () => {
    expect(haversineMiles(0,0,0,0)).toBe(0);
    const miles = haversineMiles(52.4862,-1.8904,51.5074,-0.1278);
    expect(miles).toBeGreaterThan(80);
    expect(miles).toBeLessThan(120);
  });
  it('uses a conservative candidate bounding box', () => {
    const box = geoBounds(52.4862,-1.8904,25);
    expect(box.latitude.gte).toBeLessThan(52.4862);
    expect(box.latitude.lte).toBeGreaterThan(52.4862);
    expect(box.longitudeConstraint).not.toBeNull();
  });
  it('handles crossing 180 degrees longitude', () => {
    expect(geoBounds(0,179.9,50).longitudeConstraint).toHaveProperty('OR');
  });
});
