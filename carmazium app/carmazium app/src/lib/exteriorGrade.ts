export const EXTERIOR_GRADE_OPTIONS = [
    { value: 1, label: 'Excellent', defects: '0–1 reported defects' },
    { value: 2, label: 'Great', defects: '2–3 reported defects' },
    { value: 3, label: 'Good', defects: '4–5 reported defects' },
    { value: 4, label: 'Average', defects: '6–7 reported defects' },
    { value: 5, label: 'Below Average', defects: '8+ reported defects' },
] as const

export function computeExteriorGradeFromDefectCount(defectCount: number): 1 | 2 | 3 | 4 | 5 {
  const count = Number.isFinite(defectCount) ? Math.max(0, Math.floor(defectCount)) : 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  if (count <= 7) return 4;
  return 5;
}
