import { normaliseHeartbeat, OnlinePresenceService, ONLINE_WINDOW_MS, summariseOnline } from './online-presence.service';

describe('online presence', () => {
    const old = process.env.REDIS_URL;
    beforeAll(() => { delete process.env.REDIS_URL; });
    afterAll(() => { if (old) process.env.REDIS_URL = old; });

    it('rejects bad visitor ids and surfaces, normalises platforms', () => {
        expect(normaliseHeartbeat({ visitorId: 'x', surface: 'web' }, false)).toBeNull();
        expect(normaliseHeartbeat({ visitorId: 'abcd-1234-efgh', surface: 'tv' }, false)).toBeNull();
        expect(normaliseHeartbeat({ visitorId: 'abcd-1234-efgh', surface: 'app', platform: 'desktop' }, true))
            .toMatchObject({ surface: 'app', platform: 'android', signedIn: true });
        expect(normaliseHeartbeat({ visitorId: 'abcd-1234-efgh', surface: 'web', platform: 'ios' }, false))
            .toMatchObject({ surface: 'web', platform: 'mobile' });
    });

    it('summarises web and app visitors', () => {
        expect(summariseOnline([
            { surface: 'web', platform: 'desktop', signedIn: true },
            { surface: 'web', platform: 'mobile', signedIn: false },
            { surface: 'web', platform: 'installed', signedIn: false },
            { surface: 'app', platform: 'ios', signedIn: true },
            { surface: 'app', platform: 'android', signedIn: false },
        ])).toEqual({
            total: 5,
            web: { total: 3, signedIn: 1, desktop: 1, mobile: 1, installed: 1 },
            app: { total: 2, signedIn: 1, android: 1, ios: 1 },
        });
    });

    it('counts each visitor once and drops them after the online window', async () => {
        const svc = new OnlinePresenceService();
        const t0 = 1_000_000;
        await svc.heartbeat({ visitorId: 'visitor-aaaa-1', surface: 'web', platform: 'desktop' }, false, t0);
        await svc.heartbeat({ visitorId: 'visitor-aaaa-1', surface: 'web', platform: 'desktop' }, false, t0 + 60_000);
        await svc.heartbeat({ visitorId: 'visitor-bbbb-2', surface: 'app', platform: 'android' }, true, t0);
        expect((await svc.online(t0 + 61_000)).total).toBe(2);
        const later = await svc.online(t0 + 60_000 + ONLINE_WINDOW_MS + 1);
        expect(later.total).toBe(0);
        svc.onModuleDestroy();
    });
});
