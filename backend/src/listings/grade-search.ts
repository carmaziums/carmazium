/** Automatic exterior grades and insurance history are separate dimensions.
 * Legacy listings may have used the condition field for historic write-off status.
 */
export function buildGradeSearchWhere(exteriorGrades?: number[], writeOffCategories?: string[]) {
    const exteriorGrade = exteriorGrades?.length ? { in: exteriorGrades } : undefined;
    const modern = (writeOffCategories ?? []).filter(x => ['NONE', 'CAT_S', 'CAT_N', 'CAT_A', 'CAT_B'].includes(x));
    const legacy = (writeOffCategories ?? []).filter(x => ['CAT_S', 'CAT_N', 'CAT_C', 'CAT_D'].includes(x));
    const matches: object[] = [];
    if (modern.length) matches.push({ writeOffCategory: { in: modern } });
    if (legacy.length) matches.push({ condition: { in: legacy } });
    return { exteriorGrade, writeOffMatch: matches.length ? { OR: matches } : undefined };
}
