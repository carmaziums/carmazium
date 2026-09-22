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

    // ─── Admin: Live Vehicle Valuation Analytics ───────────────────────────────

    /**
     * Near-real-time valuation usage for the admin dashboard.
     *
     * "Unique sessions" is intentionally used instead of "people": anonymous
     * visitors cannot be reliably deduplicated across browsers/devices.
     * Day/hour boundaries are calculated in Europe/London so the admin's
     * "today" cards remain correct across BST/GMT changes.
     */
    async getValuationAnalytics() {
        const [
            overviewRaw,
            hourlyRaw,
            sevenDayRaw,
            funnelDailyRaw,
            recentRaw,
        ] = await Promise.all([
            this.prisma.$queryRawUnsafe<Array<{
                requests: string;
                unique_sessions: string;
                logged_in_users: string;
                logged_in_sessions: string;
                anonymous_sessions: string;
                auction_requests: string;
                retail_requests: string;
            }>>(`
                WITH bounds AS (
                    SELECT
                        (date_trunc('day', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London') AS start_utc,
                        ((date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day') AT TIME ZONE 'Europe/London') AS end_utc
                )
                SELECT
                    COUNT(*)::TEXT AS requests,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE "sessionId" IS NOT NULL)::TEXT AS unique_sessions,
                    COUNT(DISTINCT "userId") FILTER (WHERE "userId" IS NOT NULL)::TEXT AS logged_in_users,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE "userId" IS NOT NULL AND "sessionId" IS NOT NULL)::TEXT AS logged_in_sessions,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE "userId" IS NULL AND "sessionId" IS NOT NULL)::TEXT AS anonymous_sessions,
                    COUNT(*) FILTER (WHERE LOWER(COALESCE(payload->>'listing_type', '')) = 'auction')::TEXT AS auction_requests,
                    COUNT(*) FILTER (WHERE LOWER(COALESCE(payload->>'listing_type', '')) = 'retail')::TEXT AS retail_requests
                FROM analytics_events, bounds
                WHERE type = 'valuation_requested'
                  AND "createdAt" >= bounds.start_utc
                  AND "createdAt" < bounds.end_utc
            `),
            this.prisma.$queryRawUnsafe<Array<{ hour: string; requests: string; sessions: string }>>(`
                WITH bounds AS (
                    SELECT
                        (date_trunc('day', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London') AS start_utc,
                        ((date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day') AT TIME ZONE 'Europe/London') AS end_utc
                )
                SELECT
                    TO_CHAR(date_trunc('hour', "createdAt" AT TIME ZONE 'Europe/London'), 'HH24:00') AS hour,
                    COUNT(*)::TEXT AS requests,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE "sessionId" IS NOT NULL)::TEXT AS sessions
                FROM analytics_events, bounds
                WHERE type = 'valuation_requested'
                  AND "createdAt" >= bounds.start_utc
                  AND "createdAt" < bounds.end_utc
                GROUP BY date_trunc('hour', "createdAt" AT TIME ZONE 'Europe/London')
                ORDER BY date_trunc('hour', "createdAt" AT TIME ZONE 'Europe/London') ASC
            `),
            this.prisma.$queryRawUnsafe<Array<{ date: string; requests: string; sessions: string }>>(`
                SELECT
                    TO_CHAR(("createdAt" AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS date,
                    COUNT(*)::TEXT AS requests,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE "sessionId" IS NOT NULL)::TEXT AS sessions
                FROM analytics_events
                WHERE type = 'valuation_requested'
                  AND "createdAt" >= (
                      ((date_trunc('day', now() AT TIME ZONE 'Europe/London') - interval '6 days') AT TIME ZONE 'Europe/London')
                  )
                  AND "createdAt" < (
                      ((date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day') AT TIME ZONE 'Europe/London')
                  )
                GROUP BY ("createdAt" AT TIME ZONE 'Europe/London')::date
                ORDER BY ("createdAt" AT TIME ZONE 'Europe/London')::date ASC
            `),
            this.prisma.$queryRawUnsafe<Array<{
                date: string;
                valuation_journeys: string;
                started_journeys: string;
                converted_journeys: string;
                listing_count: string;
                retail_listings: string;
                auction_listings: string;
            }>>(`
                WITH raw_valuations AS (
                    SELECT
                        id,
                        "createdAt",
                        "sessionId",
                        NULLIF(payload->>'valuation_id', '') AS valuation_id,
                        TO_CHAR(("createdAt" AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS valuation_date,
                        COALESCE(
                            NULLIF(payload->>'valuation_id', ''),
                            CASE WHEN "sessionId" IS NOT NULL THEN 'session:' || "sessionId" END,
                            'event:' || id
                        ) AS journey_key
                    FROM analytics_events
                    WHERE type = 'valuation_requested'
                      AND "createdAt" >= (
                          ((date_trunc('day', now() AT TIME ZONE 'Europe/London') - interval '6 days') AT TIME ZONE 'Europe/London')
                      )
                      AND "createdAt" < (
                          ((date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day') AT TIME ZONE 'Europe/London')
                      )
                ),
                valuations AS (
                    SELECT
                        journey_key,
                        MIN("createdAt") AS first_valuation_at,
                        MIN(valuation_date) AS valuation_date,
                        MAX("sessionId") AS session_id,
                        MAX(valuation_id) AS valuation_id
                    FROM raw_valuations
                    GROUP BY journey_key
                ),
                attributed AS (
                    SELECT
                        v.*,
                        started.id AS started_event_id,
                        submitted.id AS submitted_event_id,
                        submitted.payload->>'listing_id' AS listing_id,
                        LOWER(COALESCE(submitted.payload->>'listing_type', '')) AS converted_listing_type
                    FROM valuations v
                    LEFT JOIN LATERAL (
                        SELECT e.id
                        FROM analytics_events e
                        WHERE e.type = 'listing_started'
                          AND e."createdAt" >= v.first_valuation_at
                          AND e."createdAt" < v.first_valuation_at + interval '30 days'
                          AND (
                              (v.valuation_id IS NOT NULL AND e.payload->>'valuation_id' = v.valuation_id)
                              OR (
                                  v.valuation_id IS NULL
                                  AND v.session_id IS NOT NULL
                                  AND e."sessionId" = v.session_id
                              )
                          )
                        ORDER BY e."createdAt" ASC
                        LIMIT 1
                    ) started ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT e.id, e.payload
                        FROM analytics_events e
                        WHERE e.type = 'listing_submitted'
                          AND e."createdAt" >= v.first_valuation_at
                          AND e."createdAt" < v.first_valuation_at + interval '30 days'
                          AND (
                              (v.valuation_id IS NOT NULL AND e.payload->>'valuation_id' = v.valuation_id)
                              OR (
                                  v.valuation_id IS NULL
                                  AND v.session_id IS NOT NULL
                                  AND e."sessionId" = v.session_id
                              )
                          )
                        ORDER BY e."createdAt" ASC
                        LIMIT 1
                    ) submitted ON TRUE
                )
                SELECT
                    valuation_date AS date,
                    COUNT(*)::TEXT AS valuation_journeys,
                    COUNT(*) FILTER (WHERE started_event_id IS NOT NULL)::TEXT AS started_journeys,
                    COUNT(*) FILTER (WHERE submitted_event_id IS NOT NULL)::TEXT AS converted_journeys,
                    COUNT(DISTINCT listing_id) FILTER (WHERE listing_id IS NOT NULL)::TEXT AS listing_count,
                    COUNT(DISTINCT listing_id) FILTER (
                        WHERE listing_id IS NOT NULL AND converted_listing_type = 'retail'
                    )::TEXT AS retail_listings,
                    COUNT(DISTINCT listing_id) FILTER (
                        WHERE listing_id IS NOT NULL AND converted_listing_type = 'auction'
                    )::TEXT AS auction_listings
                FROM attributed
                GROUP BY valuation_date
                ORDER BY valuation_date ASC
            `),
            this.prisma.$queryRawUnsafe<Array<{
                id: string;
                created_at: Date;
                payload: Record<string, unknown>;
                started: boolean;
                converted: boolean;
                listing_id: string | null;
                converted_listing_type: string | null;
            }>>(`
                SELECT
                    v.id,
                    v."createdAt" AS created_at,
                    v.payload,
                    (started.id IS NOT NULL) AS started,
                    (submitted.id IS NOT NULL) AS converted,
                    submitted.payload->>'listing_id' AS listing_id,
                    LOWER(NULLIF(submitted.payload->>'listing_type', '')) AS converted_listing_type
                FROM analytics_events v
                LEFT JOIN LATERAL (
                    SELECT e.id
                    FROM analytics_events e
                    WHERE e.type = 'listing_started'
                      AND e."createdAt" >= v."createdAt"
                      AND e."createdAt" < v."createdAt" + interval '30 days'
                      AND (
                          (
                              NULLIF(v.payload->>'valuation_id', '') IS NOT NULL
                              AND e.payload->>'valuation_id' = v.payload->>'valuation_id'
                          )
                          OR (
                              NULLIF(v.payload->>'valuation_id', '') IS NULL
                              AND v."sessionId" IS NOT NULL
                              AND e."sessionId" = v."sessionId"
                          )
                      )
                    ORDER BY e."createdAt" ASC
                    LIMIT 1
                ) started ON TRUE
                LEFT JOIN LATERAL (
                    SELECT e.id, e.payload
                    FROM analytics_events e
                    WHERE e.type = 'listing_submitted'
                      AND e."createdAt" >= v."createdAt"
                      AND e."createdAt" < v."createdAt" + interval '30 days'
                      AND (
                          (
                              NULLIF(v.payload->>'valuation_id', '') IS NOT NULL
                              AND e.payload->>'valuation_id' = v.payload->>'valuation_id'
                          )
                          OR (
                              NULLIF(v.payload->>'valuation_id', '') IS NULL
                              AND v."sessionId" IS NOT NULL
                              AND e."sessionId" = v."sessionId"
                          )
                      )
                    ORDER BY e."createdAt" ASC
                    LIMIT 1
                ) submitted ON TRUE
                WHERE v.type = 'valuation_requested'
                ORDER BY v."createdAt" DESC
                LIMIT 15
            `),
        ]);

        const overview = overviewRaw[0] ?? {
            requests: '0',
            unique_sessions: '0',
            logged_in_users: '0',
            logged_in_sessions: '0',
            anonymous_sessions: '0',
            auction_requests: '0',
            retail_requests: '0',
        };

        const todayDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/London',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
        const todayFunnel = funnelDailyRaw.find((row) => row.date === todayDate);
        const todayValuationJourneys = Number(todayFunnel?.valuation_journeys ?? 0);
        const todayConvertedJourneys = Number(todayFunnel?.converted_journeys ?? 0);

        return {
            timezone: 'Europe/London',
            generatedAt: new Date().toISOString(),
            attribution: {
                windowDays: 30,
                exactKey: 'valuation_id',
                historicalFallback: 'session',
            },
            today: {
                requests: Number(overview.requests ?? 0),
                uniqueSessions: Number(overview.unique_sessions ?? 0),
                loggedInUsers: Number(overview.logged_in_users ?? 0),
                loggedInSessions: Number(overview.logged_in_sessions ?? 0),
                anonymousSessions: Number(overview.anonymous_sessions ?? 0),
                auctionRequests: Number(overview.auction_requests ?? 0),
                retailRequests: Number(overview.retail_requests ?? 0),
                valuationJourneys: todayValuationJourneys,
                listingStarted: Number(todayFunnel?.started_journeys ?? 0),
                listingCreated: todayConvertedJourneys,
                uniqueListingsCreated: Number(todayFunnel?.listing_count ?? 0),
                retailListingsCreated: Number(todayFunnel?.retail_listings ?? 0),
                auctionListingsCreated: Number(todayFunnel?.auction_listings ?? 0),
                conversionRate: todayValuationJourneys > 0
                    ? Math.round((todayConvertedJourneys / todayValuationJourneys) * 1000) / 10
                    : 0,
            },
            hourly: hourlyRaw.map((row) => ({
                hour: row.hour,
                requests: Number(row.requests),
                sessions: Number(row.sessions),
            })),
            last7Days: sevenDayRaw.map((row) => {
                const funnel = funnelDailyRaw.find((item) => item.date === row.date);
                const journeys = Number(funnel?.valuation_journeys ?? 0);
                const converted = Number(funnel?.converted_journeys ?? 0);
                return {
                    date: row.date,
                    requests: Number(row.requests),
                    sessions: Number(row.sessions),
                    valuationJourneys: journeys,
                    listingStarted: Number(funnel?.started_journeys ?? 0),
                    listingCreated: converted,
                    uniqueListingsCreated: Number(funnel?.listing_count ?? 0),
                    retailListingsCreated: Number(funnel?.retail_listings ?? 0),
                    auctionListingsCreated: Number(funnel?.auction_listings ?? 0),
                    conversionRate: journeys > 0
                        ? Math.round((converted / journeys) * 1000) / 10
                        : 0,
                };
            }),
            recent: recentRaw.map((event) => {
                const payload = (event.payload ?? {}) as Record<string, unknown>;
                return {
                    id: event.id,
                    createdAt: event.created_at,
                    make: typeof payload.make === 'string' ? payload.make : null,
                    model: typeof payload.model === 'string' ? payload.model : null,
                    year: typeof payload.year === 'number' ? payload.year : Number(payload.year) || null,
                    fuelType: typeof payload.fuel_type === 'string' ? payload.fuel_type : null,
                    listingType: event.converted_listing_type
                        || (typeof payload.listing_type === 'string' ? payload.listing_type : null),
                    device: typeof payload.device === 'string' ? payload.device : null,
                    city: typeof payload.city === 'string' ? payload.city : null,
                    country: typeof payload.country === 'string' ? payload.country : null,
                    entryPoint: typeof payload.entry_point === 'string' ? payload.entry_point : null,
                    startedListing: Boolean(event.started),
                    createdListing: Boolean(event.converted),
                    listingId: event.listing_id,
                };
            }),
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
