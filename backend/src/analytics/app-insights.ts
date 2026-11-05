import { BadRequestException } from '@nestjs/common';

/**
 * App downloads/installs and customer problem reports.
 *
 * Both are stored as AnalyticsEvent rows (no schema change):
 *   app_download_click  — website "Download/Install" button tapped   {platform}
 *   app_web_installed   — browser confirmed a web-app install        {platform}
 *   app_first_open      — native app opened for the first time       {platform, installId, appVersion}
 *   app_problem_report  — customer problem report (server-written only, validated)
 */
export const APP_PLATFORMS = ['android', 'ios', 'windows', 'web'] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export const PROBLEM_CATEGORIES = [
    'not_working', 'sign_in', 'payments', 'listings', 'auctions', 'messages', 'other',
] as const;
export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export interface ProblemReportInput {
    category: string;
    message: string;
    contactEmail?: string;
    platform?: string;
    appVersion?: string;
    device?: string;
    screen?: string;
}

const clip = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    return t ? t.slice(0, max) : null;
};

/** Validates and normalises a customer problem report. Throws on bad input. */
export function normaliseProblemReport(input: ProblemReportInput) {
    const category = (PROBLEM_CATEGORIES as readonly string[]).includes(input?.category)
        ? (input.category as ProblemCategory) : null;
    if (!category) throw new BadRequestException('Choose what the problem is about');
    const message = clip(input?.message, 2000);
    if (!message || message.length < 10) {
        throw new BadRequestException('Please describe the problem in at least 10 characters');
    }
    const email = clip(input?.contactEmail, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Enter a valid email address or leave it empty');
    }
    const platform = (APP_PLATFORMS as readonly string[]).includes(input?.platform ?? '')
        ? input.platform : 'web';
    return {
        category,
        message,
        contactEmail: email,
        platform,
        appVersion: clip(input?.appVersion, 40),
        device: clip(input?.device, 120),
        screen: clip(input?.screen, 120),
        status: 'new',
    };
}

type EventRow = { type: string; payload: unknown; createdAt: Date };

const platformOf = (payload: unknown): AppPlatform | 'unknown' => {
    const p = (payload as { platform?: unknown } | null)?.platform;
    return (APP_PLATFORMS as readonly string[]).includes(p as string) ? (p as AppPlatform) : 'unknown';
};

/** Pure summary of app download/install events (unit-tested). */
export function summariseAppEvents(rows: EventRow[], since30: Date) {
    const blank = () => ({ android: 0, ios: 0, windows: 0, web: 0, unknown: 0 } as Record<AppPlatform | 'unknown', number>);
    const downloadClicks = blank();
    const webInstalls = blank();
    const installIds = new Set<string>();
    const installIds30 = new Set<string>();
    let downloadClicks30 = 0;
    let webInstalls30 = 0;
    for (const row of rows) {
        const recent = row.createdAt >= since30;
        if (row.type === 'app_download_click') {
            downloadClicks[platformOf(row.payload)] += 1;
            if (recent) downloadClicks30 += 1;
        } else if (row.type === 'app_web_installed') {
            webInstalls[platformOf(row.payload)] += 1;
            if (recent) webInstalls30 += 1;
        } else if (row.type === 'app_first_open') {
            const id = (row.payload as { installId?: unknown } | null)?.installId;
            if (typeof id === 'string' && id.length >= 8 && id.length <= 64) {
                installIds.add(id);
                if (recent) installIds30.add(id);
            }
        }
    }
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    // All-time installs per operating system (never reset).
    const installs = {
        android: installIds.size + webInstalls.android,
        androidApp: installIds.size,
        androidWebApp: webInstalls.android,
        ios: webInstalls.ios,
        windows: webInstalls.windows + webInstalls.web,
    };
    return {
        installs,
        installsTotal: installs.android + installs.ios + installs.windows,
        androidAppInstalls: installIds.size,
        androidAppInstalls30d: installIds30.size,
        webInstalls,
        webInstallsTotal: sum(webInstalls),
        webInstalls30d: webInstalls30,
        downloadClicks,
        downloadClicksTotal: sum(downloadClicks),
        downloadClicks30d: downloadClicks30,
    };
}

/** Sums GitHub Release asset downloads of the signed APKs (public repo, cached). */
let githubCache: { at: number; value: { total: number; byVersion: Record<string, number> } | null } | null = null;
export async function fetchApkReleaseDownloads(
    fetcher: typeof fetch = fetch,
    now = Date.now(),
): Promise<{ total: number; byVersion: Record<string, number> } | null> {
    if (githubCache && now - githubCache.at < 10 * 60_000) return githubCache.value;
    let value: { total: number; byVersion: Record<string, number> } | null = null;
    try {
        const res = await fetcher('https://api.github.com/repos/carmaziums/carmazium/releases?per_page=100', {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'carmazium-api' },
        });
        if (res.ok) {
            const releases = (await res.json()) as Array<{ tag_name?: string; assets?: Array<{ name?: string; download_count?: number }> }>;
            const byVersion: Record<string, number> = {};
            let total = 0;
            for (const r of releases) {
                if (!/^CarMazium-\d+\.\d+\.\d+-v\d+$/.test(r.tag_name ?? '')) continue;
                const n = (r.assets ?? [])
                    .filter(a => /\.apk$/i.test(a.name ?? ''))
                    .reduce((s, a) => s + (Number(a.download_count) || 0), 0);
                byVersion[r.tag_name as string] = n;
                total += n;
            }
            value = { total, byVersion };
        }
    } catch {
        value = null;
    }
    githubCache = { at: now, value };
    return value;
}

export function resetApkDownloadCache() { githubCache = null; }
