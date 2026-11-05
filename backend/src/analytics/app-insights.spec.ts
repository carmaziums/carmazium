import { fetchApkReleaseDownloads, normaliseProblemReport, resetApkDownloadCache, summariseAppEvents } from './app-insights';
import { assertPublicAnalyticsEvent } from './analytics-event-policy';

describe('normaliseProblemReport', () => {
    it('accepts a valid report and defaults status to new', () => {
        const r = normaliseProblemReport({ category: 'payments', message: '  Card payment failed twice  ', contactEmail: 'a@b.co', platform: 'android', appVersion: '1.0.0' });
        expect(r).toMatchObject({ category: 'payments', message: 'Card payment failed twice', contactEmail: 'a@b.co', platform: 'android', status: 'new' });
    });
    it('rejects unknown categories, short messages and bad emails', () => {
        expect(() => normaliseProblemReport({ category: 'spam', message: 'long enough message' })).toThrow();
        expect(() => normaliseProblemReport({ category: 'other', message: 'short' })).toThrow();
        expect(() => normaliseProblemReport({ category: 'other', message: 'long enough message', contactEmail: 'nope' })).toThrow();
    });
    it('clips long text and falls back to web platform', () => {
        const r = normaliseProblemReport({ category: 'other', message: 'x'.repeat(5000), platform: 'evil' });
        expect(r.message).toHaveLength(2000);
        expect(r.platform).toBe('web');
    });
    it('cannot be written through the public analytics endpoint', () => {
        expect(() => assertPublicAnalyticsEvent({ type: 'app_problem_report' } as any)).toThrow();
        expect(() => assertPublicAnalyticsEvent({ type: 'app_first_open', payload: { platform: 'android' } } as any)).not.toThrow();
    });
});

describe('summariseAppEvents', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const old = new Date('2026-08-01T00:00:00Z');
    it('counts unique native installs, web installs and download clicks by platform', () => {
        const s = summariseAppEvents([
            { type: 'app_first_open', payload: { platform: 'android', installId: 'device-aaaa-1' }, createdAt: now },
            { type: 'app_first_open', payload: { platform: 'android', installId: 'device-aaaa-1' }, createdAt: now },
            { type: 'app_first_open', payload: { platform: 'android', installId: 'device-bbbb-2' }, createdAt: old },
            { type: 'app_first_open', payload: { platform: 'android', installId: 'x' }, createdAt: now },
            { type: 'app_web_installed', payload: { platform: 'ios' }, createdAt: now },
            { type: 'app_web_installed', payload: { platform: 'windows' }, createdAt: old },
            { type: 'app_download_click', payload: { platform: 'android' }, createdAt: now },
            { type: 'app_download_click', payload: { platform: 'nonsense' }, createdAt: now },
        ], since30);
        expect(s.androidAppInstalls).toBe(2);
        expect(s.androidAppInstalls30d).toBe(1);
        expect(s.webInstalls).toMatchObject({ ios: 1, windows: 1 });
        expect(s.webInstallsTotal).toBe(2);
        expect(s.webInstalls30d).toBe(1);
        expect(s.downloadClicks).toMatchObject({ android: 1, unknown: 1 });
        expect(s.downloadClicksTotal).toBe(2);
        expect(s.installs).toEqual({ android: 2, androidApp: 2, androidWebApp: 0, ios: 1, windows: 1 });
        expect(s.installsTotal).toBe(4);
    });
});

describe('fetchApkReleaseDownloads', () => {
    beforeEach(() => resetApkDownloadCache());
    it('sums APK assets of CarMazium releases only', async () => {
        const fake = jest.fn().mockResolvedValue({ ok: true, json: async () => ([
            { tag_name: 'CarMazium-1.0.0-v100', assets: [{ name: 'CarMazium-1.0.0-v100.apk', download_count: 7 }, { name: 'notes.txt', download_count: 50 }] },
            { tag_name: 'something-else', assets: [{ name: 'x.apk', download_count: 99 }] },
        ]) });
        await expect(fetchApkReleaseDownloads(fake as any, 1000)).resolves.toEqual({ total: 7, byVersion: { 'CarMazium-1.0.0-v100': 7 } });
        await fetchApkReleaseDownloads(fake as any, 2000);
        expect(fake).toHaveBeenCalledTimes(1);
    });
    it('returns null when GitHub is unavailable', async () => {
        const fake = jest.fn().mockRejectedValue(new Error('down'));
        await expect(fetchApkReleaseDownloads(fake as any, 1000)).resolves.toBeNull();
    });
});
