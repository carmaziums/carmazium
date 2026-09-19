import { BadRequestException } from '@nestjs/common';

export const DEFAULT_SERVICE_PAGE_LIMIT = 20;
export const MAX_SERVICE_PAGE_LIMIT = 50;

export type ServiceCursor = {
    at: string;
    id: string;
    priority?: boolean;
};

export function encodeServiceCursor(cursor: ServiceCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeServiceCursor(raw?: string | null): ServiceCursor | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        if (
            !parsed ||
            typeof parsed.at !== 'string' ||
            !Number.isFinite(new Date(parsed.at).getTime()) ||
            typeof parsed.id !== 'string' ||
            !parsed.id ||
            (parsed.priority !== undefined && typeof parsed.priority !== 'boolean')
        ) {
            throw new Error('invalid');
        }
        return parsed;
    } catch {
        throw new BadRequestException('Invalid pagination cursor.');
    }
}

export function boundedServiceLimit(value?: number): number {
    if (!Number.isInteger(value)) return DEFAULT_SERVICE_PAGE_LIMIT;
    return Math.min(Math.max(value!, 1), MAX_SERVICE_PAGE_LIMIT);
}

export function makeServicePage<T>(
    rows: T[],
    limit: number,
    cursorFor: (row: T) => ServiceCursor,
): { items: T[]; nextCursor: string | null } {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
        items,
        nextCursor: hasMore && items.length
            ? encodeServiceCursor(cursorFor(items[items.length - 1]))
            : null,
    };
}
