import { AnalyticsController } from './analytics.controller';
import { assertPublicAnalyticsEvent } from './analytics-event-policy';
import { BadRequestException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';

describe('Analytics public telemetry integrity', () => {
    it.each([
        'auction_bid_placed',
        'auction_bid_cancelled',
        'auction_outcome',
        'valuation_base_snapshot',
        'valuation_quote_issued',
        'valuation_price_lock',
        'listing_approved',
        'listing_rejected',
        'admin_draft_auction_relist',
    ])('rejects forged backend-only event type %s', (type) => {
        expect(() => assertPublicAnalyticsEvent({ type })).toThrow(BadRequestException);
    });

    it('accepts legitimate frontend telemetry and rejects oversized payloads', () => {
        for (const type of ['page_view', 'valuation_requested', 'listing_started', 'listing_submitted', 'auction_submitted_for_review', 'purchase', 'search']) {
            expect(() => assertPublicAnalyticsEvent({ type, sessionId: 'browser-tab-session' })).not.toThrow();
        }
        expect(() => assertPublicAnalyticsEvent({ type: 'page_view', payload: { description: 'x'.repeat(17_000) } })).toThrow(BadRequestException);
        expect(() => assertPublicAnalyticsEvent({ type: 'page_view', sessionId: 'x'.repeat(129) })).toThrow(BadRequestException);
        expect(() => assertPublicAnalyticsEvent({ type: 'invalid-name!' })).toThrow(BadRequestException);
    });

    function setup(user: { id: string } | undefined = undefined, tokenUser: { id: string } | null = null) {
        const analytics = { trackEvent: jest.fn().mockResolvedValue({ id: 'tracked' }) };
        const auth = { verifySupabaseToken: jest.fn().mockResolvedValue(tokenUser) };
        const controller = new AnalyticsController(analytics as any, {} as any, auth as any);
        const request: { headers: { authorization?: string }; ip: string; user?: { id: string } } = {
            headers: {}, ip: '203.0.113.1', user,
        };
        return { analytics, auth, controller, request };
    }

    it('does not trust a forged userId from a public unauthenticated request', async () => {
        const { analytics, controller, request } = setup();
        const event: CreateEventDto = { type: 'page_view', userId: 'another-person', sessionId: 'test' };
        await expect(controller.trackEvent(event, request as any)).resolves.toEqual({ ok: true });
        expect(analytics.trackEvent).toHaveBeenCalledWith(expect.objectContaining({
            userId: undefined, sessionId: 'test',
        }));
    });

    it('uses only session-hydrated verified user identity when no bearer is sent', async () => {
        const { analytics, controller, request } = setup({ id: 'verified-user' });
        await controller.trackEvent({ type: 'listing_started', userId: 'spoofed' }, request as any);
        expect(analytics.trackEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'verified-user' }));
    });

    it('prefers a verified bearer token over conflicting session identity', async () => {
        const { analytics, controller, request, auth } = setup({ id: 'old-session' }, { id: 'current-token-user' });
        request.headers = { authorization: 'Bearer real-verified-token' };
        await controller.trackEvent({ type: 'listing_submitted', userId: 'spoofed' }, request as any);
        expect(auth.verifySupabaseToken).toHaveBeenCalledWith('real-verified-token');
        expect(analytics.trackEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'current-token-user' }));
    });

    it('does not fall back to a conflicting session on an invalid bearer token', async () => {
        const { analytics, controller, request } = setup({ id: 'old-session' }, null);
        request.headers = { authorization: 'Bearer rejected-token' };
        await controller.trackEvent({ type: 'search', userId: 'spoofed' }, request as any);
        expect(analytics.trackEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
    });
});
