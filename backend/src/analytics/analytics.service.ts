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
                valuation_attempts: string;
                figures_returned: string;
                confirmed_no_figures: string;
            }>>(`
                WITH bounds AS (
                    SELECT
                        (date_trunc('day', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London') AS start_utc,
                        ((date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day') AT TIME ZONE 'Europe/London') AS end_utc
                )
                SELECT
                    COUNT(*) FILTER (WHERE type = 'valuation_requested')::TEXT AS requests,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'valuation_requested' AND "sessionId" IS NOT NULL)::TEXT AS unique_sessions,
                    COUNT(DISTINCT "userId") FILTER (WHERE type = 'valuation_requested' AND "userId" IS NOT NULL)::TEXT AS logged_in_users,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'valuation_requested' AND "userId" IS NOT NULL AND "sessionId" IS NOT NULL)::TEXT AS logged_in_sessions,
                    COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'valuation_requested' AND "userId" IS NULL AND "sessionId" IS NOT NULL)::TEXT AS anonymous_sessions,
                    COUNT(*) FILTER (WHERE type = 'valuation_requested' AND LOWER(COALESCE(payload->>'listing_type', '')) = 'auction')::TEXT AS auction_requests,
                    COUNT(*) FILTER (WHERE type = 'valuation_requested' AND LOWER(COALESCE(payload->>'listing_type', '')) = 'retail')::TEXT AS retail_requests,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (WHERE type = 'valuation_attempted')::TEXT AS valuation_attempts,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (
                            WHERE type = 'valuation_requested'
                              AND LOWER(COALESCE(payload->>'valuation_result', '')) = 'figures_returned'
                        )::TEXT AS figures_returned,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (
                            WHERE type = 'valuation_failed'
                               OR (
                                   type = 'valuation_requested'
                                   AND LOWER(COALESCE(payload->>'valuation_result', '')) = 'no_figures'
                               )
                        )::TEXT AS confirmed_no_figures
                FROM analytics_events, bounds
                WHERE type IN ('valuation_requested', 'valuation_attempted', 'valuation_failed')
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
            this.prisma.$queryRawUnsafe<Array<{
                date: string;
                requests: string;
                sessions: string;
                valuation_attempts: string;
                figures_returned: string;
                confirmed_no_figures: string;
            }>>(`
                SELECT
                    TO_CHAR(("createdAt" AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS date,
                    COUNT(*) FILTER (WHERE type = 'valuation_requested')::TEXT AS requests,
                    COUNT(DISTINCT "sessionId") FILTER (
                        WHERE type = 'valuation_requested' AND "sessionId" IS NOT NULL
                    )::TEXT AS sessions,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (WHERE type = 'valuation_attempted')::TEXT AS valuation_attempts,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (
                            WHERE type = 'valuation_requested'
                              AND LOWER(COALESCE(payload->>'valuation_result', '')) = 'figures_returned'
                        )::TEXT AS figures_returned,
                    COUNT(DISTINCT COALESCE(NULLIF(payload->>'valuation_id', ''), 'event:' || id))
                        FILTER (
                            WHERE type = 'valuation_failed'
                               OR (
                                   type = 'valuation_requested'
                                   AND LOWER(COALESCE(payload->>'valuation_result', '')) = 'no_figures'
                               )
                        )::TEXT AS confirmed_no_figures
                FROM analytics_events
                WHERE type IN ('valuation_requested', 'valuation_attempted', 'valuation_failed')
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
                retail_fee_paid: string;
                reached_review: string;
                retail_reached_review: string;
                auction_reached_review: string;
                approved_live: string;
                rejected: string;
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
                        LOWER(COALESCE(submitted.payload->>'listing_type', '')) AS converted_listing_type,
                        listing.status::TEXT AS listing_status,
                        listing."reviewedAt" AS reviewed_at,
                        (fee.id IS NOT NULL) AS retail_fee_paid,
                        (approval.id IS NOT NULL) AS approval_event
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
                    LEFT JOIN listings listing
                      ON listing.id = submitted.payload->>'listing_id'
                     AND listing."deletedAt" IS NULL
                    LEFT JOIN LATERAL (
                        SELECT t.id
                        FROM transactions t
                        WHERE t."listingId" = submitted.payload->>'listing_id'
                          AND t.type::TEXT = 'LISTING_FEE'
                          AND t.status::TEXT = 'COMPLETED'
                          AND t."deletedAt" IS NULL
                        ORDER BY t."updatedAt" ASC
                        LIMIT 1
                    ) fee ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT e.id
                        FROM analytics_events e
                        WHERE e.type = 'listing_approved'
                          AND e.payload->>'listing_id' = submitted.payload->>'listing_id'
                          AND e."createdAt" >= v.first_valuation_at
                          AND e."createdAt" < v.first_valuation_at + interval '30 days'
                        ORDER BY e."createdAt" ASC
                        LIMIT 1
                    ) approval ON TRUE
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
                    )::TEXT AS auction_listings,
                    COUNT(*) FILTER (
                        WHERE converted_listing_type = 'retail' AND retail_fee_paid
                    )::TEXT AS retail_fee_paid,
                    COUNT(*) FILTER (
                        WHERE listing_id IS NOT NULL
                          AND listing_status IN ('PENDING_REVIEW', 'ACTIVE', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED')
                    )::TEXT AS reached_review,
                    COUNT(*) FILTER (
                        WHERE converted_listing_type = 'retail'
                          AND listing_status IN ('PENDING_REVIEW', 'ACTIVE', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED')
                    )::TEXT AS retail_reached_review,
                    COUNT(*) FILTER (
                        WHERE converted_listing_type = 'auction'
                          AND listing_status IN ('PENDING_REVIEW', 'ACTIVE', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED')
                    )::TEXT AS auction_reached_review,
                    COUNT(*) FILTER (
                        WHERE listing_id IS NOT NULL
                          AND (
                            approval_event
                            OR listing_status IN ('ACTIVE', 'OFFER_ACCEPTED', 'SOLD')
                            OR (listing_status = 'WITHDRAWN' AND reviewed_at IS NOT NULL)
                          )
                    )::TEXT AS approved_live,
                    COUNT(*) FILTER (
                        WHERE listing_id IS NOT NULL AND listing_status = 'REJECTED'
                    )::TEXT AS rejected
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
                listing_status: string | null;
                listing_vrm: string | null;
                listing_mileage: number | null;
                fee_paid: boolean;
                reached_review: boolean;
                approved_live: boolean;
                rejected: boolean;
            }>>(`
                SELECT
                    v.id,
                    v."createdAt" AS created_at,
                    v.payload,
                    (started.id IS NOT NULL) AS started,
                    (submitted.id IS NOT NULL) AS converted,
                    submitted.payload->>'listing_id' AS listing_id,
                    LOWER(NULLIF(submitted.payload->>'listing_type', '')) AS converted_listing_type,
                    listing.status::TEXT AS listing_status,
                    listing.vrm AS listing_vrm,
                    listing.mileage AS listing_mileage,
                    (fee.id IS NOT NULL) AS fee_paid,
                    (
                        listing.status::TEXT IN ('PENDING_REVIEW', 'ACTIVE', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED')
                    ) AS reached_review,
                    (
                        approval.id IS NOT NULL
                        OR listing.status::TEXT IN ('ACTIVE', 'OFFER_ACCEPTED', 'SOLD')
                        OR (listing.status::TEXT = 'WITHDRAWN' AND listing."reviewedAt" IS NOT NULL)
                    ) AS approved_live,
                    (listing.status::TEXT = 'REJECTED') AS rejected
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
                LEFT JOIN listings listing
                  ON listing.id = submitted.payload->>'listing_id'
                 AND listing."deletedAt" IS NULL
                LEFT JOIN LATERAL (
                    SELECT t.id
                    FROM transactions t
                    WHERE t."listingId" = submitted.payload->>'listing_id'
                      AND t.type::TEXT = 'LISTING_FEE'
                      AND t.status::TEXT = 'COMPLETED'
                      AND t."deletedAt" IS NULL
                    ORDER BY t."updatedAt" ASC
                    LIMIT 1
                ) fee ON TRUE
                LEFT JOIN LATERAL (
                    SELECT e.id
                    FROM analytics_events e
                    WHERE e.type = 'listing_approved'
                      AND e.payload->>'listing_id' = submitted.payload->>'listing_id'
                      AND e."createdAt" >= v."createdAt"
                      AND e."createdAt" < v."createdAt" + interval '30 days'
                    ORDER BY e."createdAt" ASC
                    LIMIT 1
                ) approval ON TRUE
                WHERE v.type = 'valuation_requested'
                ORDER BY v."createdAt" DESC
                LIMIT 100
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
            valuation_attempts: '0',
            figures_returned: '0',
            confirmed_no_figures: '0',
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
        const todayReachedReview = Number(todayFunnel?.reached_review ?? 0);
        const todayApprovedLive = Number(todayFunnel?.approved_live ?? 0);
        const todayValuationAttempts = Number(overview.valuation_attempts ?? 0);
        const todayFiguresReturned = Number(overview.figures_returned ?? 0);
        const todayConfirmedNoFigures = Number(overview.confirmed_no_figures ?? 0);
        const todayWithoutFigures = todayConfirmedNoFigures;

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
                valuationAttempts: todayValuationAttempts,
                figuresReturned: todayFiguresReturned,
                withoutFigures: todayWithoutFigures,
                confirmedNoFigures: todayConfirmedNoFigures,
                figureSuccessRate: todayValuationAttempts > 0
                    ? Math.round((todayFiguresReturned / todayValuationAttempts) * 1000) / 10
                    : 0,
                valuationJourneys: todayValuationJourneys,
                listingStarted: Number(todayFunnel?.started_journeys ?? 0),
                listingCreated: todayConvertedJourneys,
                uniqueListingsCreated: Number(todayFunnel?.listing_count ?? 0),
                retailListingsCreated: Number(todayFunnel?.retail_listings ?? 0),
                auctionListingsCreated: Number(todayFunnel?.auction_listings ?? 0),
                retailFeePaid: Number(todayFunnel?.retail_fee_paid ?? 0),
                reachedReview: todayReachedReview,
                retailReachedReview: Number(todayFunnel?.retail_reached_review ?? 0),
                auctionReachedReview: Number(todayFunnel?.auction_reached_review ?? 0),
                approvedLive: todayApprovedLive,
                rejected: Number(todayFunnel?.rejected ?? 0),
                conversionRate: todayValuationJourneys > 0
                    ? Math.round((todayConvertedJourneys / todayValuationJourneys) * 1000) / 10
                    : 0,
                approvalRate: todayConvertedJourneys > 0
                    ? Math.round((todayApprovedLive / todayConvertedJourneys) * 1000) / 10
                    : 0,
                liveFromValuationRate: todayValuationJourneys > 0
                    ? Math.round((todayApprovedLive / todayValuationJourneys) * 1000) / 10
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
                const valuationAttempts = Number(row.valuation_attempts ?? 0);
                const figuresReturned = Number(row.figures_returned ?? 0);
                const confirmedNoFigures = Number(row.confirmed_no_figures ?? 0);
                const withoutFigures = confirmedNoFigures;
                return {
                    date: row.date,
                    requests: Number(row.requests),
                    sessions: Number(row.sessions),
                    valuationAttempts,
                    figuresReturned,
                    withoutFigures,
                    confirmedNoFigures,
                    figureSuccessRate: valuationAttempts > 0
                        ? Math.round((figuresReturned / valuationAttempts) * 1000) / 10
                        : 0,
                    valuationJourneys: journeys,
                    listingStarted: Number(funnel?.started_journeys ?? 0),
                    listingCreated: converted,
                    uniqueListingsCreated: Number(funnel?.listing_count ?? 0),
                    retailListingsCreated: Number(funnel?.retail_listings ?? 0),
                    auctionListingsCreated: Number(funnel?.auction_listings ?? 0),
                    retailFeePaid: Number(funnel?.retail_fee_paid ?? 0),
                    reachedReview: Number(funnel?.reached_review ?? 0),
                    retailReachedReview: Number(funnel?.retail_reached_review ?? 0),
                    auctionReachedReview: Number(funnel?.auction_reached_review ?? 0),
                    approvedLive: Number(funnel?.approved_live ?? 0),
                    rejected: Number(funnel?.rejected ?? 0),
                    conversionRate: journeys > 0
                        ? Math.round((converted / journeys) * 1000) / 10
                        : 0,
                    approvalRate: converted > 0
                        ? Math.round((Number(funnel?.approved_live ?? 0) / converted) * 1000) / 10
                        : 0,
                    liveFromValuationRate: journeys > 0
                        ? Math.round((Number(funnel?.approved_live ?? 0) / journeys) * 1000) / 10
                        : 0,
                };
            }),
            recent: recentRaw.map((event) => {
                const payload = (event.payload ?? {}) as Record<string, unknown>;
                const numberFromPayload = (key: string) => {
                    const raw = payload[key];
                    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
                    if (typeof raw === 'string' && raw.trim()) {
                        const parsed = Number(raw);
                        return Number.isFinite(parsed) ? parsed : null;
                    }
                    return null;
                };
                const registration = typeof payload.registration === 'string' && payload.registration.trim()
                    ? payload.registration.trim().replace(/\s+/g, '').toUpperCase()
                    : event.listing_vrm?.replace(/\s+/g, '').toUpperCase() || null;
                const mileage = numberFromPayload('mileage') ?? event.listing_mileage ?? null;

                return {
                    id: event.id,
                    createdAt: event.created_at,
                    registration,
                    mileage,
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
                    valuationResult: typeof payload.valuation_result === 'string' ? payload.valuation_result : null,
                    valuationSource: typeof payload.valuation_source === 'string' ? payload.valuation_source : null,
                    valuationConfidence: typeof payload.valuation_confidence === 'string' ? payload.valuation_confidence : null,
                    valuationConfidenceScore: numberFromPayload('valuation_confidence_score'),
                    noFigureReason: typeof payload.no_figure_reason === 'string' ? payload.no_figure_reason : null,
                    valuationComparables: numberFromPayload('valuation_comparables') ?? 0,
                    liveMarketStatus: typeof payload.live_market_status === 'string' ? payload.live_market_status : null,
                    valuationLow: numberFromPayload('valuation_low'),
                    valuationMid: numberFromPayload('valuation_mid'),
                    valuationHigh: numberFromPayload('valuation_high'),
                    marketValue: numberFromPayload('market_value'),
                    auctionOpeningBid: numberFromPayload('auction_opening_bid'),
                    auctionReserveLow: numberFromPayload('auction_reserve_low'),
                    auctionReserveHigh: numberFromPayload('auction_reserve_high'),
                    auctionSuggestedReserve: numberFromPayload('auction_suggested_reserve'),
                    retailSuggestedAsking: numberFromPayload('retail_suggested_asking'),
                    retailSuggestedMinimum: numberFromPayload('retail_suggested_minimum'),
                    startedListing: Boolean(event.started),
                    createdListing: Boolean(event.converted),
                    listingId: event.listing_id,
                    listingStatus: event.listing_status,
                    feePaid: Boolean(event.fee_paid),
                    reachedReview: Boolean(event.reached_review),
                    approvedLive: Boolean(event.approved_live),
                    rejected: Boolean(event.rejected),
                };
            }),
        };
    }

    // ─── Admin: Auction First-Offer Analytics ──────────────────────────────────

    /**
     * Measures the new zero-bid opening-offer rule from first-party server events.
     *
     * Tracking intentionally starts when this feature is deployed. Historical
     * auctions are not reconstructed or guessed because the exact first-offer
     * floor, reserve at bid time and cancellation sequence were not previously
     * retained as immutable analytics facts.
     */
    async getAuctionFirstOfferAnalytics(days = 30) {
        const safeDays = Math.min(365, Math.max(1, Math.trunc(Number(days) || 30)));

        const [summaryRaw, recentRaw] = await Promise.all([
            this.prisma.$queryRawUnsafe<Array<{
                first_offers: string;
                unique_auctions: string;
                competition_auctions: string;
                first_offer_cancellations: string;
                seller_accepted_sales: string;
                reserve_met_sales: string;
                unsold_auctions: string;
                pending_auctions: string;
                zero_bid_unsold: string;
                zero_bid_reserve_corrections: string;
                avg_first_offer: string | null;
                avg_reserve_at_first_offer: string | null;
                avg_percent_below_reserve: string | null;
                avg_percent_below_starting: string | null;
            }>>(`
                WITH first_offers AS (
                    SELECT
                        e.id,
                        e."createdAt",
                        e.payload,
                        e.payload->>'auction_id' AS auction_id,
                        e.payload->>'bid_id' AS bid_id,
                        NULLIF(e.payload->>'amount', '')::NUMERIC AS amount,
                        NULLIF(e.payload->>'reserve_price', '')::NUMERIC AS reserve_price,
                        NULLIF(e.payload->>'percent_below_reserve', '')::NUMERIC AS percent_below_reserve,
                        NULLIF(e.payload->>'percent_below_starting_bid', '')::NUMERIC AS percent_below_starting
                    FROM analytics_events e
                    WHERE e.type = 'auction_bid_placed'
                      AND LOWER(COALESCE(e.payload->>'is_first_offer', 'false')) = 'true'
                      AND e."createdAt" >= now() - interval '${safeDays} days'
                ),
                cohort AS (
                    SELECT
                        f.*,
                        EXISTS (
                            SELECT 1
                            FROM analytics_events b
                            WHERE b.type = 'auction_bid_placed'
                              AND b.payload->>'auction_id' = f.auction_id
                              AND b."createdAt" > f."createdAt"
                        ) AS had_competition,
                        EXISTS (
                            SELECT 1
                            FROM analytics_events c
                            WHERE c.type = 'auction_bid_cancelled'
                              AND c.payload->>'cancelled_bid_id' = f.bid_id
                              AND c."createdAt" >= f."createdAt"
                        ) AS first_offer_cancelled,
                        (
                            SELECT o.payload->>'outcome'
                            FROM analytics_events o
                            WHERE o.type = 'auction_outcome'
                              AND o.payload->>'auction_id' = f.auction_id
                              AND o."createdAt" >= f."createdAt"
                            ORDER BY o."createdAt" DESC
                            LIMIT 1
                        ) AS outcome
                    FROM first_offers f
                )
                SELECT
                    COUNT(*)::TEXT AS first_offers,
                    COUNT(DISTINCT auction_id)::TEXT AS unique_auctions,
                    COUNT(DISTINCT auction_id) FILTER (WHERE had_competition)::TEXT AS competition_auctions,
                    COUNT(*) FILTER (WHERE first_offer_cancelled)::TEXT AS first_offer_cancellations,
                    COUNT(DISTINCT auction_id) FILTER (WHERE outcome = 'SELLER_ACCEPTED_BELOW_RESERVE')::TEXT AS seller_accepted_sales,
                    COUNT(DISTINCT auction_id) FILTER (WHERE outcome = 'RESERVE_MET_SALE')::TEXT AS reserve_met_sales,
                    COUNT(DISTINCT auction_id) FILTER (
                        WHERE outcome IN ('BELOW_RESERVE_UNSOLD', 'SELLER_EARLY_CLOSE_UNSOLD', 'NO_BIDS_UNSOLD')
                    )::TEXT AS unsold_auctions,
                    COUNT(DISTINCT auction_id) FILTER (WHERE outcome IS NULL)::TEXT AS pending_auctions,
                    (
                        SELECT COUNT(*)::TEXT
                        FROM analytics_events o
                        WHERE o.type = 'auction_outcome'
                          AND o.payload->>'outcome' = 'NO_BIDS_UNSOLD'
                          AND o."createdAt" >= now() - interval '${safeDays} days'
                    ) AS zero_bid_unsold,
                    (
                        SELECT COUNT(*)::TEXT
                        FROM analytics_events r
                        WHERE r.type = 'auction_reserve_corrected'
                          AND COALESCE(r.payload->>'active_bid_count', '0') = '0'
                          AND r."createdAt" >= now() - interval '${safeDays} days'
                    ) AS zero_bid_reserve_corrections,
                    AVG(amount)::TEXT AS avg_first_offer,
                    AVG(reserve_price)::TEXT AS avg_reserve_at_first_offer,
                    AVG(percent_below_reserve)::TEXT AS avg_percent_below_reserve,
                    AVG(percent_below_starting)::TEXT AS avg_percent_below_starting
                FROM cohort
            `),
            this.prisma.$queryRawUnsafe<Array<{
                id: string;
                created_at: Date;
                auction_id: string | null;
                listing_id: string | null;
                bid_id: string | null;
                registration: string | null;
                vehicle: string | null;
                amount: string | null;
                starting_bid: string | null;
                reserve_price: string | null;
                first_offer_floor: string | null;
                percent_below_reserve: string | null;
                percent_below_starting: string | null;
                subsequent_bid_count: string;
                first_offer_cancelled: boolean;
                outcome: string | null;
                outcome_at: Date | null;
            }>>(`
                SELECT
                    f.id,
                    f."createdAt" AS created_at,
                    f.payload->>'auction_id' AS auction_id,
                    f.payload->>'listing_id' AS listing_id,
                    f.payload->>'bid_id' AS bid_id,
                    NULLIF(f.payload->>'registration', '') AS registration,
                    NULLIF(f.payload->>'vehicle', '') AS vehicle,
                    NULLIF(f.payload->>'amount', '') AS amount,
                    NULLIF(f.payload->>'starting_bid', '') AS starting_bid,
                    NULLIF(f.payload->>'reserve_price', '') AS reserve_price,
                    NULLIF(f.payload->>'first_offer_floor', '') AS first_offer_floor,
                    NULLIF(f.payload->>'percent_below_reserve', '') AS percent_below_reserve,
                    NULLIF(f.payload->>'percent_below_starting_bid', '') AS percent_below_starting,
                    (
                        SELECT COUNT(*)::TEXT
                        FROM analytics_events b
                        WHERE b.type = 'auction_bid_placed'
                          AND b.payload->>'auction_id' = f.payload->>'auction_id'
                          AND b."createdAt" > f."createdAt"
                    ) AS subsequent_bid_count,
                    EXISTS (
                        SELECT 1
                        FROM analytics_events c
                        WHERE c.type = 'auction_bid_cancelled'
                          AND c.payload->>'cancelled_bid_id' = f.payload->>'bid_id'
                          AND c."createdAt" >= f."createdAt"
                    ) AS first_offer_cancelled,
                    outcome.payload->>'outcome' AS outcome,
                    outcome."createdAt" AS outcome_at
                FROM analytics_events f
                LEFT JOIN LATERAL (
                    SELECT o.payload, o."createdAt"
                    FROM analytics_events o
                    WHERE o.type = 'auction_outcome'
                      AND o.payload->>'auction_id' = f.payload->>'auction_id'
                      AND o."createdAt" >= f."createdAt"
                    ORDER BY o."createdAt" DESC
                    LIMIT 1
                ) outcome ON TRUE
                WHERE f.type = 'auction_bid_placed'
                  AND LOWER(COALESCE(f.payload->>'is_first_offer', 'false')) = 'true'
                  AND f."createdAt" >= now() - interval '${safeDays} days'
                ORDER BY f."createdAt" DESC
                LIMIT 100
            `),
        ]);

        const summary = summaryRaw[0] ?? {
            first_offers: '0',
            unique_auctions: '0',
            competition_auctions: '0',
            first_offer_cancellations: '0',
            seller_accepted_sales: '0',
            reserve_met_sales: '0',
            unsold_auctions: '0',
            pending_auctions: '0',
            zero_bid_unsold: '0',
            zero_bid_reserve_corrections: '0',
            avg_first_offer: null,
            avg_reserve_at_first_offer: null,
            avg_percent_below_reserve: null,
            avg_percent_below_starting: null,
        };

        const uniqueAuctions = Number(summary.unique_auctions ?? 0);
        const competitionAuctions = Number(summary.competition_auctions ?? 0);
        const sellerAcceptedSales = Number(summary.seller_accepted_sales ?? 0);
        const reserveMetSales = Number(summary.reserve_met_sales ?? 0);
        const completedSales = sellerAcceptedSales + reserveMetSales;

        const asNumber = (value: string | null | undefined) => {
            if (value == null || value === '') return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const rate = (numerator: number, denominator: number) =>
            denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

        return {
            generatedAt: new Date().toISOString(),
            windowDays: safeDays,
            trackingNote: 'Server-side tracking starts with the first-offer feature deployment; historical auctions are not reconstructed.',
            summary: {
                firstOffers: Number(summary.first_offers ?? 0),
                uniqueAuctions,
                competitionAuctions,
                competitionRate: rate(competitionAuctions, uniqueAuctions),
                firstOfferCancellations: Number(summary.first_offer_cancellations ?? 0),
                sellerAcceptedSales,
                reserveMetSales,
                completedSales,
                saleRate: rate(completedSales, uniqueAuctions),
                unsoldAuctions: Number(summary.unsold_auctions ?? 0),
                pendingAuctions: Number(summary.pending_auctions ?? 0),
                zeroBidUnsold: Number(summary.zero_bid_unsold ?? 0),
                zeroBidReserveCorrections: Number(summary.zero_bid_reserve_corrections ?? 0),
                averageFirstOffer: asNumber(summary.avg_first_offer),
                averageReserveAtFirstOffer: asNumber(summary.avg_reserve_at_first_offer),
                averagePercentBelowReserve: asNumber(summary.avg_percent_below_reserve),
                averagePercentBelowStartingBid: asNumber(summary.avg_percent_below_starting),
            },
            recent: recentRaw.map((row) => ({
                id: row.id,
                createdAt: row.created_at,
                auctionId: row.auction_id,
                listingId: row.listing_id,
                bidId: row.bid_id,
                registration: row.registration,
                vehicle: row.vehicle,
                amount: asNumber(row.amount),
                startingBid: asNumber(row.starting_bid),
                reservePrice: asNumber(row.reserve_price),
                firstOfferFloor: asNumber(row.first_offer_floor),
                percentBelowReserve: asNumber(row.percent_below_reserve),
                percentBelowStartingBid: asNumber(row.percent_below_starting),
                subsequentBidCount: Number(row.subsequent_bid_count ?? 0),
                firstOfferCancelled: Boolean(row.first_offer_cancelled),
                outcome: row.outcome,
                outcomeAt: row.outcome_at,
            })),
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
