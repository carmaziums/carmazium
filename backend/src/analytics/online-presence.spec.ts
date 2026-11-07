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
        await svc.heartbeat({ visitorId: 'visitor-aaaa-1', surface: 'web', platform: 'desktop' }, null, t0);
        await svc.heartbeat({ visitorId: 'visitor-aaaa-1', surface: 'web', platform: 'desktop' }, null, t0 + 60_000);
        await svc.heartbeat({ visitorId: 'visitor-bbbb-2', surface: 'app', platform: 'android' }, 'verified-account-1', t0);
        expect((await svc.online(t0 + 61_000)).total).toBe(2);
        const later = await svc.online(t0 + 60_000 + ONLINE_WINDOW_MS + 1);
        expect(later.total).toBe(0);
        svc.onModuleDestroy();
    });

    it('never trusts an unverified signedIn property sent by a guest', async () => {
        const svc = new OnlinePresenceService();
        await svc.heartbeat({ visitorId: 'visitor-guest-1', surface: 'web', platform: 'desktop', signedIn: true } as any, null, 1000);
        expect((await svc.online(1001)).web.signedIn).toBe(0);
        svc.onModuleDestroy();
    });

    it('deduplicates two signed-in browser tabs belonging to one verified account', async () => {
        const svc = new OnlinePresenceService();
        const now = 1000;
        await svc.heartbeat({ visitorId: 'visitor-a-01', surface: 'web', platform: 'desktop' }, 'account-a', now);
        await svc.heartbeat({ visitorId: 'visitor-b-02', surface: 'web', platform: 'desktop' }, 'account-a', now + 1);
        await svc.heartbeat({ visitorId: 'visitor-c-03', surface: 'web', platform: 'mobile' }, 'account-b', now + 2);
        const snapshot = await svc.online(now + 3);
        expect(snapshot.web.total).toBe(2);
        expect(snapshot.web.signedIn).toBe(2);
        svc.onModuleDestroy();
    });

    it('removes a guest tab heartbeat after its identity is authenticated', async () => {
        const svc = new OnlinePresenceService();
        await svc.heartbeat({ visitorId: 'visitor-a-01', surface: 'web', platform: 'desktop' }, null, 1000);
        await svc.heartbeat({ visitorId: 'visitor-a-01', surface: 'web', platform: 'desktop' }, 'account-a', 1001);
        const snapshot = await svc.online(1002);
        expect(snapshot.total).toBe(1);
        expect(snapshot.web.signedIn).toBe(1);
        svc.onModuleDestroy();
    });

    it('keeps web and native activity distinguishable for the same account', async () => {
        const svc = new OnlinePresenceService();
        await svc.heartbeat({ visitorId: 'visitor-web-1', surface: 'web', platform: 'mobile' }, 'account-a', 1000);
        await svc.heartbeat({ visitorId: 'visitor-app-1', surface: 'app', platform: 'android' }, 'account-a', 1001);
        const snapshot = await svc.online(1002);
        expect(snapshot.web.signedIn).toBe(1);
        expect(snapshot.app.signedIn).toBe(1);
        svc.onModuleDestroy();
    });
});
