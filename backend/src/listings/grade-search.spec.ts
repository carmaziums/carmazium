import { buildGradeSearchWhere } from './grade-search';

describe('exterior grades and write-off filtering', () => {
  it('filters stored grades 1–5 rather than seller condition', () => {
    expect(buildGradeSearchWhere([1, 2])).toEqual({ exteriorGrade: { in: [1, 2] }, writeOffMatch: undefined });
  });
  it('matches both modern and legacy Cat S records', () => {
    expect(buildGradeSearchWhere(undefined, ['CAT_S'])).toEqual({
      exteriorGrade: undefined, writeOffMatch: { OR: [
        { writeOffCategory: { in: ['CAT_S'] } }, { condition: { in: ['CAT_S'] } },
      ] },
    });
  });
  it('supports historic C/D classifications without invalid Prisma enum filters', () => {
    expect(buildGradeSearchWhere([5], ['CAT_C', 'CAT_D'])).toEqual({
      exteriorGrade: { in: [5] }, writeOffMatch: { OR: [{ condition: { in: ['CAT_C', 'CAT_D'] } }] },
    });
  });
  it('never treats NONE as an unverified condition grade', () => {
    expect(buildGradeSearchWhere(undefined, ['NONE'])).toEqual({
      exteriorGrade: undefined, writeOffMatch: { OR: [{ writeOffCategory: { in: ['NONE'] } }] },
    });
  });
  it('does not constrain when grade and write-off filters are omitted', () => {
    expect(buildGradeSearchWhere()).toEqual({ exteriorGrade: undefined, writeOffMatch: undefined });
  });
});
