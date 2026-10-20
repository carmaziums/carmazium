import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUOTE_HISTORY_MONTHS } from '../listings/valuation-quote-history';

/**
 * Admin-only, independently paginated, 12-month history. Customer identities
 * never leave the backend. Server receipts take precedence over browser events.
 * A legacy price lock is recovered only if neither a server receipt nor an
 * equivalent priced browser event was recorded. No old quotation is invented.
 */
@Injectable()
export class ValuationHistoryService {
    constructor(private readonly prisma: PrismaService) {}

    async getHistory(search = '', page = 1) {
        const safePage = Number.isFinite(page) ? Math.max(1, Math.min(100, Math.floor(page))) : 1;
        const term = search.trim().slice(0, 60);
        const cutoff = new Date();
        cutoff.setUTCMonth(cutoff.getUTCMonth() - QUOTE_HISTORY_MONTHS);

        // SQL is constant. All user values use bound Postgres parameters.
        const base = [
            "WITH archived AS (",
            ' SELECT e.id,e.type,e."createdAt",',
            " NULLIF(COALESCE(e.payload#>>'{identity,registration}',e.payload->>'registration'),'') AS registration,",
            " NULLIF(COALESCE(e.payload#>>'{identity,make}',e.payload->>'make'),'') AS make,",
            " NULLIF(COALESCE(e.payload#>>'{identity,model}',e.payload->>'model'),'') AS model,",
            " NULLIF(COALESCE(e.payload#>>'{identity,year}',e.payload->>'year'),'')::integer AS year,",
            " NULLIF(COALESCE(e.payload#>>'{identity,mileage}',e.payload->>'mileage'),'')::integer AS mileage,",
            " NULLIF(COALESCE(e.payload#>>'{valuation,auction,marketValue}',e.payload->>'market_value'),'')::numeric AS auction,",
            " NULLIF(COALESCE(e.payload#>>'{valuation,retail,suggestedAsking}',e.payload->>'retail_suggested_asking'),'')::numeric AS retail,",
            " NULLIF(COALESCE(e.payload#>>'{valuation,source}',e.payload->>'valuation_source'),'') AS source,",
            " NULLIF(e.payload->>'valuation_id','') AS valuation_id",
            ' FROM analytics_events e WHERE e.type IN (\'valuation_quote_issued\',\'valuation_requested\',\'valuation_price_lock\')',
            ' AND e."createdAt" >= $1',
            '), delivered AS (',
            ' SELECT a.* FROM archived a WHERE a.auction > 0 AND a.retail > 0',
            " AND (a.type = 'valuation_quote_issued'",
            " OR (a.type = 'valuation_requested' AND NOT EXISTS (",
            " SELECT 1 FROM archived s WHERE s.type='valuation_quote_issued'",
            ' AND s."createdAt" BETWEEN a."createdAt" - interval \'5 minutes\' AND a."createdAt" + interval \'5 minutes\'',
            ' AND ((a.valuation_id IS NOT NULL AND a.valuation_id = s.valuation_id)',
            ' OR (a.valuation_id IS NULL AND a.registration IS NOT NULL AND a.registration=s.registration))',
            ' ))',
            // The old pre-receipt price lock is evidence of a real quote, but
            // must not add a second history row when a browser or server event
            // already represents the same valuation. Use only existing prices.
            " OR (a.type = 'valuation_price_lock'",
            " AND NOT EXISTS (SELECT 1 FROM archived s",
            " WHERE s.type='valuation_quote_issued'",
            ' AND s."createdAt" BETWEEN a."createdAt" - interval \'1 minute\' AND a."createdAt" + interval \'25 hours\'',
            " AND a.registration IS NOT NULL AND s.registration IS NOT NULL",
            " AND regexp_replace(upper(s.registration),'[^A-Z0-9]','','g')",
            " = regexp_replace(upper(a.registration),'[^A-Z0-9]','','g')",
            ' )',
            " AND NOT EXISTS (SELECT 1 FROM archived s",
            " WHERE s.type='valuation_requested' AND s.auction > 0 AND s.retail > 0",
            ' AND s."createdAt" BETWEEN a."createdAt" - interval \'15 minutes\' AND a."createdAt" + interval \'15 minutes\'',
            " AND a.registration IS NOT NULL AND s.registration IS NOT NULL",
            " AND regexp_replace(upper(s.registration),'[^A-Z0-9]','','g')",
            " = regexp_replace(upper(a.registration),'[^A-Z0-9]','','g')",
            " ))",
            " )",
            " AND ($2='' OR CONCAT_WS(' ',a.registration,a.make,a.model,a.year::text) ILIKE $2)",
            ')',
        ].join(' ');

        // An empty search uses a '%' wildcard, a nonempty search matches
        // registration / make / model, including partial vehicle names.
        const pattern = term ? '%' + term + '%' : '';
        const rows = await this.prisma.$queryRawUnsafe<Array<{
            id: string; createdAt: Date; registration: string | null;
            make: string | null; model: string | null; year: number | null;
            mileage: number | null; auction: Prisma.Decimal | null;
            retail: Prisma.Decimal | null; source: string | null; type: string;
        }>>(base + ' SELECT id,"createdAt",registration,make,model,year,mileage,auction,retail,source,type'
            + ' FROM delivered ORDER BY "createdAt" DESC,id DESC LIMIT 101 OFFSET $3',
            cutoff, pattern, (safePage - 1) * 100);

        const groups = await this.prisma.$queryRawUnsafe<Array<{
            make: string; model: string; year: number | null; quotes: bigint; uniqueVehicles: bigint;
            auctionMedian: number | null; retailMedian: number | null;
        }>>(base +
            " SELECT COALESCE(make,'Unknown') AS make,COALESCE(model,'Unknown') AS model,year,"
            + ' COUNT(*) AS quotes,'
            + " COUNT(DISTINCT NULLIF(regexp_replace(UPPER(COALESCE(registration,'')), '[^A-Z0-9]', '', 'g'), '')) AS \"uniqueVehicles\","
            + ' percentile_cont(0.5) WITHIN GROUP (ORDER BY auction::double precision) AS "auctionMedian",'
            + ' percentile_cont(0.5) WITHIN GROUP (ORDER BY retail::double precision) AS "retailMedian"'
            + ' FROM delivered GROUP BY make,model,year ORDER BY quotes DESC LIMIT 30',
            cutoff, pattern);

        return {
            months: QUOTE_HISTORY_MONTHS,
            page: safePage,
            hasMore: rows.length > 100,
            rows: rows.slice(0, 100).map(row => ({
                id: row.id, createdAt: row.createdAt, registration: row.registration,
                make: row.make, model: row.model, year: row.year, mileage: row.mileage,
                auctionPrice: row.auction == null ? null : Number(row.auction),
                retailPrice: row.retail == null ? null : Number(row.retail),
                source: row.source, origin: row.type,
            })),
            byModel: groups.map(g => ({
                make: g.make, model: g.model, year: g.year, quotes: Number(g.quotes),
                uniqueVehicles: Number(g.uniqueVehicles),
                auctionMedian: g.auctionMedian == null ? null : Number(g.auctionMedian),
                retailMedian: g.retailMedian == null ? null : Number(g.retailMedian),
            })),
            note: 'Historic CarMazium quotations are estimates, not achieved sale prices or new market advertisements.',
        };
    }
}
