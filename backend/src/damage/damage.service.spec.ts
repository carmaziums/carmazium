import { computeExteriorGrade } from './damage.service';

describe('computeExteriorGrade', () => {
  const defects = (count: number) => Array.from({ length: count }, () => ({ size: 'MEDIUM' }));

  it.each([
    [0, 1],
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [6, 4],
    [7, 5],
    [12, 5],
  ])('maps %i reported defects to grade %i', (count, expected) => {
    expect(computeExteriorGrade(defects(count))).toBe(expected);
  });
});
