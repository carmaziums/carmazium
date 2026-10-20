import { BadRequestException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';

/**
 * These events are materialised by trusted backend code from canonical auction,
 * listing and valuation workflows. Public browser telemetry must never write
 * lookalike rows that could fabricate admin revenue/funnel/auction outcomes.
 *
 * Keep this a denylist rather than a blanket browser-event allowlist, since
 * legitimate product-funnel event names evolve across web and native clients.
 */
const BACKEND_ONLY_EVENT_TYPES = new Set([
    'auction_bid_placed',
    'auction_bid_cancelled',
    'auction_outcome',
    'auction_reserve_corrected',
    'valuation_base_snapshot',
    'valuation_quote_issued',
    'valuation_price_lock',
    'listing_approved',
    'listing_rejected',
    'admin_draft_auction_relist',
]);

export function assertPublicAnalyticsEvent(dto: CreateEventDto): void {
    if (typeof dto.type !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(dto.type)) {
        throw new BadRequestException('Invalid analytics event type');
    }
    if (dto.type.startsWith('admin_') || BACKEND_ONLY_EVENT_TYPES.has(dto.type)) {
        throw new BadRequestException('This analytics event requires a server-side workflow');
    }
    if (dto.sessionId !== undefined && (
        typeof dto.sessionId !== 'string' || dto.sessionId.length > 128
    )) {
        throw new BadRequestException('Invalid analytics session ID');
    }
    if (dto.payload !== undefined) {
        let payloadBytes = 0;
        try {
            payloadBytes = Buffer.byteLength(JSON.stringify(dto.payload), 'utf8');
        } catch {
            throw new BadRequestException('Invalid analytics payload');
        }
        if (payloadBytes > 16_384) {
            throw new BadRequestException('Analytics payload exceeds 16 KiB');
        }
    }
}
