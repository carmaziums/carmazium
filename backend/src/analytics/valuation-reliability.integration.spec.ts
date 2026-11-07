import { PrismaService } from '../prisma/prisma.service';
import { VALUATION_RELIABILITY_SQL, ValuationReliabilityRow, reliabilityMetrics } from './valuation-reliability';

const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('Valuation reliability SQL: matched journey cohorts', () => {
    let db: PrismaService;
    beforeAll(() => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Disposable CI Postgres only');
        db = new PrismaService();
    });
    afterAll(async () => { await db?.$disconnect(); });
    it('deduplicates attempts, recovers retries, separates orphan outcomes and attributes midnight outcomes to the attempt day', async () => {
        const events: any[] = [];
        const add = (type: string, journey: string | null, at: string, result?: string) => events.push({ id: String(events.length), type, createdAt: at, payload: { valuation_id: journey, valuation_result: result } });
        add('valuation_attempted','ok','2026-10-25T10:00:00');
        add('valuation_attempted','ok','2026-10-25T10:00:01');
        add('valuation_failed','ok','2026-10-25T10:00:02');
        add('valuation_requested','ok','2026-10-25T10:00:03','figures_returned');
        add('valuation_requested','ok','2026-10-25T10:00:04','figures_returned');
        add('valuation_attempted','failed','2026-10-25T10:01:00');
        add('valuation_failed','failed','2026-10-25T10:01:02');
        add('valuation_attempted','pending','2026-10-25T10:02:00');
        add('valuation_requested','orphan','2026-10-25T10:03:00','figures_returned');
        add('valuation_requested',null,'2026-10-25T10:04:00','figures_returned');
        // 22:59 UTC is 23:59 BST on the previous day; its delayed result is next day.
        add('valuation_attempted','midnight','2026-10-24T22:59:00');
        add('valuation_requested','midnight','2026-10-24T23:01:00','figures_returned');
        const sql = VALUATION_RELIABILITY_SQL.replace('WITH events AS', `WITH analytics_events AS (SELECT * FROM json_to_recordset($1::json) AS e(id text,type text,"createdAt" timestamp,payload jsonb)), events AS`).replace(/now\(\)/g, "'2026-10-25T12:00:00Z'::timestamptz");
        const rows = await db.$queryRawUnsafe<ValuationReliabilityRow[]>(sql, JSON.stringify(events));
        expect(reliabilityMetrics(rows.find(r => r.date === '2026-10-25'))).toEqual({ valuationAttempts: 3, figuresReturned: 1, withoutFigures: 1, confirmedNoFigures: 1, pendingOutcomes: 1, unmatchedOutcomes: 2, figureSuccessRate: 33.3 });
        expect(reliabilityMetrics(rows.find(r => r.date === '2026-10-24'))).toMatchObject({ valuationAttempts: 1, figuresReturned: 1, figureSuccessRate: 100 });
    });
});
