/**
 * An MOT lookup and a restored browser draft must produce the same shape.
 * MOT snapshots are optional; invalid entries must not prevent the seller
 * from submitting a retail or auction listing. Never invent missing tests.
 */
export function normalizeMotHistorySnapshot<T extends object = Record<string, unknown>>(value: unknown): T[] {
    let history = value;
    if (typeof history === 'string') {
        try {
            history = JSON.parse(history) as unknown;
        } catch {
            return [];
        }
    }
    if (!Array.isArray(history)) return [];

    return history.flatMap((entry: unknown): T[] => {
        let test = entry;
        if (typeof test === 'string') {
            try {
                test = JSON.parse(test) as unknown;
            } catch {
                return [];
            }
        }
        return test && typeof test === 'object' && !Array.isArray(test) ? [test as T] : [];
    });
}
