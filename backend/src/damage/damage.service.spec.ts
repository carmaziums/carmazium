import { computeExteriorGrade } from './damage.service';

describe('computeExteriorGrade', () => {
  const defects = (count: number) => Array.from({ length: count }, () => ({ size: 'MEDIUM' }));

  it.each([
    [0, 1],
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [5, 3],
    [6, 4],
    [7, 4],
    [8, 5],
    [12, 5],
  ])('maps %i reported defects to grade %i', (count, expected) => {
    expect(computeExteriorGrade(defects(count))).toBe(expected);
  });
});
