/** Browser outcomes are measured against the same attempted journeys.
 * Latest outcome wins (a recovered retry is not both a success and failure).
 * Legacy outcomes without a matching attempt remain visible, outside the rate.
 * createdAt is Prisma's timestamp-without-time-zone, stored in UTC.
 */
export const VALUATION_RELIABILITY_SQL = `
WITH events AS (
    SELECT id,type,"createdAt",payload,
        NULLIF(payload->>'valuation_id','') AS journey
    FROM analytics_events
    WHERE type IN ('valuation_attempted','valuation_requested','valuation_failed')
      AND "createdAt" >= ((date_trunc('day',now() AT TIME ZONE 'Europe/London') - interval '7 days') AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC'
), attempts AS (
    SELECT COALESCE(journey,'event:'||id) AS key, journey, MIN("createdAt") AS started
    FROM events WHERE type='valuation_attempted'
    GROUP BY COALESCE(journey,'event:'||id),journey
), outcomes AS (
    SELECT *, CASE WHEN type='valuation_requested' AND payload->>'valuation_result'='figures_returned'
        THEN 'success' ELSE 'failure' END AS result
    FROM events WHERE type='valuation_failed'
       OR (type='valuation_requested' AND payload->>'valuation_result' IN ('figures_returned','no_figures'))
), matched AS (
    SELECT a.*,o.result FROM attempts a
    LEFT JOIN LATERAL (
        SELECT result FROM outcomes o WHERE a.journey IS NOT NULL AND o.journey=a.journey
          AND o."createdAt">=a.started AND o."createdAt"<=a.started+interval '24 hours'
        ORDER BY o."createdAt" DESC,o.id DESC LIMIT 1
    ) o ON TRUE
), daily AS (
    SELECT (started AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date AS day,
        count(*)::int AS attempts,
        count(*) FILTER (WHERE result='success')::int AS successes,
        count(*) FILTER (WHERE result='failure')::int AS failures,
        count(*) FILTER (WHERE result IS NULL)::int AS pending
    FROM matched GROUP BY day
), unmatched AS (
    SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date AS day,
        count(DISTINCT COALESCE(o.journey,'event:'||o.id))::int AS unmatched
    FROM outcomes o WHERE NOT EXISTS (
        SELECT 1 FROM attempts a WHERE a.journey=o.journey
          AND o."createdAt">=a.started AND o."createdAt"<=a.started+interval '24 hours'
    ) GROUP BY day
)
SELECT TO_CHAR(COALESCE(d.day,u.day),'YYYY-MM-DD') AS date,
    COALESCE(attempts,0) AS attempts,COALESCE(successes,0) AS successes,
    COALESCE(failures,0) AS failures,COALESCE(pending,0) AS pending,COALESCE(unmatched,0) AS unmatched
FROM daily d FULL JOIN unmatched u ON u.day=d.day
WHERE COALESCE(d.day,u.day)>=(now() AT TIME ZONE 'Europe/London')::date-6
ORDER BY date
`;

export interface ValuationReliabilityRow {
    date: string; attempts: number; successes: number; failures: number; pending: number; unmatched: number;
}

export function reliabilityMetrics(row?: ValuationReliabilityRow) {
    const attempts = Number(row?.attempts ?? 0);
    const successes = Number(row?.successes ?? 0);
    return {
        valuationAttempts: attempts,
        figuresReturned: successes,
        withoutFigures: Number(row?.failures ?? 0),
        confirmedNoFigures: Number(row?.failures ?? 0),
        pendingOutcomes: Number(row?.pending ?? 0),
        unmatchedOutcomes: Number(row?.unmatched ?? 0),
        figureSuccessRate: attempts ? Math.round(successes / attempts * 1000) / 10 : 0,
    };
}
