export function computeExteriorGradeFromDefectCount(defectCount: number): 1 | 2 | 3 | 4 | 5 {
  const count = Number.isFinite(defectCount) ? Math.max(0, Math.floor(defectCount)) : 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  if (count <= 7) return 4;
  return 5;
}
