export function chronologicalHours<T extends { hour: number | string }>(rows: T[]): T[] {
    return rows.slice().sort((a, b) => Number(a.hour) - Number(b.hour))
}
