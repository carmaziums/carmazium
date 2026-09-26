/**
 * Automatic exterior grade derived only from the number of seller-reported
 * damage/defect records.
 *
 * CarMazium grading rule:
 *   0-1 defects -> Grade 1
 *   2-3 defects -> Grade 2
 *   4-5 defects -> Grade 3
 *   6-7 defects -> Grade 4
 *   8+ defects  -> Grade 5
 */
export function computeExteriorGradeFromDefectCount(defectCount: number): 1 | 2 | 3 | 4 | 5 {
    const count = Number.isFinite(defectCount) ? Math.max(0, Math.floor(defectCount)) : 0
    if (count <= 1) return 1
    if (count <= 3) return 2
    if (count <= 5) return 3
    if (count <= 7) return 4
    return 5
}
