/**
 * Automatic exterior grade derived only from the number of seller-reported
 * damage/defect records.
 *
 * CarMazium grading rule:
 *   0 defects   -> Grade 1
 *   1-2 defects -> Grade 2
 *   3-4 defects -> Grade 3
 *   5-6 defects -> Grade 4
 *   7+ defects  -> Grade 5
 */
export function computeExteriorGradeFromDefectCount(defectCount: number): 1 | 2 | 3 | 4 | 5 {
    const count = Number.isFinite(defectCount) ? Math.max(0, Math.floor(defectCount)) : 0
    if (count === 0) return 1
    if (count <= 2) return 2
    if (count <= 4) return 3
    if (count <= 6) return 4
    return 5
}
