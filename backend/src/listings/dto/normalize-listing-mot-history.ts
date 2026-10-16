/**
 * Official MOT history is optional supporting evidence, not a prerequisite
 * for a vehicle listing. Older/restored clients sometimes serialize individual
 * test objects inside an otherwise valid array; class-validator rejects those
 * strings with "each value in motHistory must be an object".
 *
 * Keep genuine objects unchanged, recover JSON-serialized objects, and omit
 * entries that cannot be interpreted as objects. Never fabricate MOT tests.
 * The DTO still enforces an array and its maximum size after this transform.
 */
export function normalizeListingMotHistory(value: unknown): unknown {
    let history = value;

    if (typeof history === 'string') {
        try {
            history = JSON.parse(history) as unknown;
        } catch {
            return [];
        }
    }

    if (!Array.isArray(history)) return history;

    return history.flatMap((entry: unknown): Record<string, unknown>[] => {
        let item = entry;
        if (typeof item === 'string') {
            try {
                item = JSON.parse(item) as unknown;
            } catch {
                return [];
            }
        }
        return item && typeof item === 'object' && !Array.isArray(item)
            ? [item as Record<string, unknown>]
            : [];
    });
}
