import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CaptureEmailDto } from './dto/capture-email.dto';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─── Track Event ──────────────────────────────────────────────────────────

    async trackEvent(dto: CreateEventDto) {
        try {
            return await this.prisma.analyticsEvent.create({
                data: {
                    type: dto.type,
                    payload: dto.payload ?? {},
                    sessionId: dto.sessionId,
                    userId: dto.userId,
                },
            });
        } catch (error) {
            this.logger.warn(`Failed to track event: ${error}`);
            return null;
        }
    }

    // ─── Capture Email ────────────────────────────────────────────────────────

    async captureEmail(dto: CaptureEmailDto) {
        return this.prisma.emailCapture.upsert({
            where: { email: dto.email },
            create: { email: dto.email, source: dto.source },
            update: { source: dto.source },
        });
    }

    // ─── Admin: Summary Stats ─────────────────────────────────────────────────

    async getSummary() {
        const [totalEvents, uniqueSessionGroups, totalEmails, eventsByType] =
            await Promise.all([
                this.prisma.analyticsEvent.count(),
                this.prisma.analyticsEvent.groupBy({ by: ['sessionId'], _count: true }),
                this.prisma.emailCapture.count(),
                this.prisma.analyticsEvent.groupBy({
                    by: ['type'],
                    _count: true,
                    orderBy: { _count: { type: 'desc' } },
                }),
            ]);

        return {
            totalEvents,
            uniqueSessions: uniqueSessionGroups.length,
            totalEmails,
            eventsByType: eventsByType.map((e) => ({ type: e.type, count: e._count })),
        };
    }

    /**
     * Verification snapshot used by the admin analytics page.
     * These are live database counts, not marketing estimates. Unverified
     * accounts remain in the database so their owners can finish verification;
     * they are simply excluded from visitor-facing account/profile surfaces.
     */
    async getAccountVerificationStats() {
        const [
            activeAccounts,
            verifiedAccounts,
            unverifiedAccounts,
            publicVerifiedProfiles,
            verifiedDealerBusinesses,
            unverifiedDealerBusinessRecords,
        ] = await Promise.all([
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: { deletedAt: null, isEmailVerified: true } }),
            this.prisma.user.count({ where: { deletedAt: null, isEmailVerified: false } }),
            this.prisma.user.count({
                where: { deletedAt: null, isEmailVerified: true, showPublicProfile: true },
            }),
            this.prisma.dealerProfile.count({
                where: {
                    deletedAt: null,
                    isVerified: true,
                    user: { is: { deletedAt: null, isEmailVerified: true } },
                },
            }),
            this.prisma.dealerProfile.count({
                where: {
                    deletedAt: null,
                    isVerified: false,
                    user: { is: { deletedAt: null, isEmailVerified: true } },
                },
            }),
        ]);

        return {
            activeAccounts,
            verifiedAccounts,
            unverifiedAccounts,
            publicVerifiedProfiles,
            verifiedDealerBusinesses,
            unverifiedDealerBusinessRecords,
        };
    }

    // ─── Admin: Paginated Events ──────────────────────────────────────────────

    async getEvents(page = 1, limit = 50, type?: string) {
        const where = type ? { type } : {};
        const [events, total] = await Promise.all([
            this.prisma.analyticsEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.analyticsEvent.count({ where }),
        ]);
        return { events, total, page, limit, pages: Math.ceil(total / limit) };
    }

    // ─── Admin: Email Leads ───────────────────────────────────────────────────

    async getEmailLeads(page = 1, limit = 50) {
        const [emails, total] = await Promise.all([
            this.prisma.emailCapture.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.emailCapture.count(),
        ]);
        return { emails, total, page, limit, pages: Math.ceil(total / limit) };
    }

    // ─── Admin: Traffic Analytics ─────────────────────────────────────────────

    async getTrafficAnalytics(from: Date, to: Date) {
        // PageViewTracker runs globally, including on authenticated dashboards
        // and login pages. Those are product/internal journeys rather than
        // visitor traffic, so every traffic query uses this same public-route
        // filter. This keeps overview cards, charts and breakdown tables in sync.
        const publicRouteFilter = `
            AND COALESCE(payload->>'url', '') NOT LIKE '/dashboard%'
            AND COALESCE(payload->>'url', '') NOT LIKE '/admin%'
            AND COALESCE(payload->>'url', '') NOT LIKE '/auth%'
        `;

        const [overviewRaw, excludedInternalRaw, trafficByDayRaw, byDowRaw, byHourRaw, topPagesRaw, referrersRaw, citiesRaw, countriesRaw, devicesRaw, topSearchesRaw] =
            await Promise.all([
                this.prisma.$queryRawUnsafe<Array<{ pageviews: string; sessions: string; searches: string }>>(
                    `SELECT
                        COUNT(*) FILTER (WHERE type = 'page_view')::TEXT AS pageviews,
                        COUNT(DISTINCT "sessionId") FILTER (WHERE "sessionId" IS NOT NULL)::TEXT AS sessions,
                        COUNT(*) FILTER (WHERE type = 'search')::TEXT AS searches
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}`,
                    from, to,
                ),
                this.prisma.$queryRawUnsafe<Array<{ pageviews: string }>>(
                    `SELECT COUNT(*)::TEXT AS pageviews
                     FROM analytics_events
                     WHERE type = 'page_view'
                       AND "createdAt" >= $1 AND "createdAt" <= $2
                       AND (
                           COALESCE(payload->>'url', '') LIKE '/dashboard%'
                           OR COALESCE(payload->>'url', '') LIKE '/admin%'
                           OR COALESCE(payload->>'url', '') LIKE '/auth%'
                       )`,
                    from, to,
                ),
                // Traffic by day (unique first-party sessions per day)
                this.prisma.$queryRawUnsafe<Array<{ date: string; sessions: string; pageviews: string }>>(
                    `SELECT DATE("createdAt")::TEXT AS date,
                            COUNT(DISTINCT "sessionId")::TEXT AS sessions,
                            COUNT(*) FILTER (WHERE type = 'page_view')::TEXT AS pageviews
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}
                     GROUP BY DATE("createdAt")
                     ORDER BY date ASC`,
                    from, to,
                ),
                // Busiest day of week (0=Sun, 6=Sat)
                this.prisma.$queryRawUnsafe<Array<{ dow: string; sessions: string }>>(
                    `SELECT EXTRACT(DOW FROM "createdAt")::TEXT AS dow,
                            COUNT(DISTINCT "sessionId")::TEXT AS sessions
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}
                     GROUP BY EXTRACT(DOW FROM "createdAt")
                     ORDER BY dow ASC`,
                    from, to,
                ),
                // Busiest hour of day (0–23)
                this.prisma.$queryRawUnsafe<Array<{ hour: string; sessions: string }>>(
                    `SELECT EXTRACT(HOUR FROM "createdAt")::TEXT AS hour,
                            COUNT(DISTINCT "sessionId")::TEXT AS sessions
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}
                     GROUP BY EXTRACT(HOUR FROM "createdAt")
                     ORDER BY hour ASC`,
                    from, to,
                ),
                // Top public pages by view count
                this.prisma.$queryRawUnsafe<Array<{ url: string; views: string }>>(
                    `SELECT payload->>'url' AS url, COUNT(*)::TEXT AS views
                     FROM analytics_events
                     WHERE type = 'page_view'
                       AND "createdAt" >= $1 AND "createdAt" <= $2
                       ${publicRouteFilter}
                       AND payload->>'url' IS NOT NULL
                       AND payload->>'url' != ''
                     GROUP BY payload->>'url'
                     ORDER BY COUNT(*) DESC
                     LIMIT 20`,
                    from, to,
                ),
                // Referrers for public-site sessions
                this.prisma.$queryRawUnsafe<Array<{ referrer: string; count: string }>>(
                    `SELECT COALESCE(NULLIF(payload->>'referrer', ''), 'Direct') AS referrer,
                            COUNT(DISTINCT "sessionId")::TEXT AS count
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}
                     GROUP BY COALESCE(NULLIF(payload->>'referrer', ''), 'Direct')
                     ORDER BY COUNT(DISTINCT "sessionId") DESC
                     LIMIT 20`,
                    from, to,
                ),
                // Top cities
                this.prisma.$queryRawUnsafe<Array<{ city: string; count: string }>>(
                    `SELECT payload->>'city' AS city,
                            COUNT(DISTINCT "sessionId")::TEXT AS count
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                       ${publicRouteFilter}
                       AND payload->>'city' IS NOT NULL
                       AND payload->>'city' != ''
                     GROUP BY payload->>'city'
                     ORDER BY COUNT(DISTINCT "sessionId") DESC
                     LIMIT 20`,
                    from, to,
                ),
                // Top countries
                this.prisma.$queryRawUnsafe<Array<{ country: string; count: string }>>(
                    `SELECT payload->>'country' AS country,
                            COUNT(DISTINCT "sessionId")::TEXT AS count
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                       ${publicRouteFilter}
                       AND payload->>'country' IS NOT NULL
                       AND payload->>'country' != ''
                     GROUP BY payload->>'country'
                     ORDER BY COUNT(DISTINCT "sessionId") DESC
                     LIMIT 20`,
                    from, to,
                ),
                // Devices
                this.prisma.$queryRawUnsafe<Array<{ device: string; count: string }>>(
                    `SELECT COALESCE(NULLIF(payload->>'device', ''), 'Unknown') AS device,
                            COUNT(DISTINCT "sessionId")::TEXT AS count
                     FROM analytics_events
                     WHERE "createdAt" >= $1 AND "createdAt" <= $2
                     ${publicRouteFilter}
                     GROUP BY COALESCE(NULLIF(payload->>'device', ''), 'Unknown')
                     ORDER BY COUNT(DISTINCT "sessionId") DESC`,
                    from, to,
                ),
                // Top searches on visitor-facing routes
                this.prisma.$queryRawUnsafe<Array<{ query: string; count: string }>>(
                    `SELECT payload->>'query' AS query, COUNT(*)::TEXT AS count
                     FROM analytics_events
                     WHERE type = 'search'
                       AND "createdAt" >= $1 AND "createdAt" <= $2
                       ${publicRouteFilter}
                       AND payload->>'query' IS NOT NULL
                       AND payload->>'query' != ''
                     GROUP BY payload->>'query'
                     ORDER BY COUNT(*) DESC
                     LIMIT 20`,
                    from, to,
                ),
            ]);

        const pageViews = Number(overviewRaw[0]?.pageviews ?? 0);
        // sessionStorage generates one ID per browser tab/session. This is a
        // truthful "unique sessions" metric, not a claim of deduplicated people.
        const uniqueVisitors = Number(overviewRaw[0]?.sessions ?? 0);
        const searches = Number(overviewRaw[0]?.searches ?? 0);
        const pagesPerVisit = uniqueVisitors > 0 ? Math.round((pageViews / uniqueVisitors) * 10) / 10 : 0;
        const excludedInternalPageViews = Number(excludedInternalRaw[0]?.pageviews ?? 0);

        return {
            overview: {
                pageViews,
                uniqueVisitors,
                pagesPerVisit,
                searches,
                excludedInternalPageViews,
            },
            dataQuality: {
                source: 'CarMazium first-party analytics events',
                visitorMetric: 'Unique Sessions',
                excludedRoutes: ['/dashboard', '/admin', '/auth'],
            },
            trafficByDay: trafficByDayRaw.map(r => ({
                date: r.date,
                sessions: Number(r.sessions),
                pageviews: Number(r.pageviews),
            })),
            busyDayOfWeek: byDowRaw.map(r => ({ dow: Number(r.dow), sessions: Number(r.sessions) })),
            busyHour: byHourRaw.map(r => ({ hour: Number(r.hour), sessions: Number(r.sessions) })),
            topPages: topPagesRaw.map(r => ({ url: r.url, views: Number(r.views) })),
            referrers: referrersRaw.map(r => ({ referrer: r.referrer, count: Number(r.count) })),
            topCities: citiesRaw.map(r => ({ city: r.city, count: Number(r.count) })),
            topCountries: countriesRaw.map(r => ({ country: r.country, count: Number(r.count) })),
            devices: devicesRaw.map(r => ({ device: r.device, count: Number(r.count) })),
            topSearches: topSearchesRaw.map(r => ({ query: r.query, count: Number(r.count) })),
        };
    }
}
