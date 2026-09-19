import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const requiredTables = [
    'contractor_profiles',
    'contractor_capabilities',
    'service_jobs',
    'service_job_vehicles',
    'service_quotes',
    'service_payments',
    'service_leads',
    'service_lead_recipients',
    'service_case_entries',
    'service_reviews',
    'service_settlement_operations',
    'service_payment_audit_events',
    'service_capability_status_history',
    'trade_service_team_permissions',
    'trade_service_team_action_log',
] as const;

const requiredColumns: Array<[string, string]> = [
    ['contractor_capabilities', 'verificationStatus'],
    ['contractor_capabilities', 'verificationExpiresAt'],
    ['contractor_capabilities', 'jobNationwide'],
    ['contractor_capabilities', 'jobPostcodeAreas'],
    ['contractor_capabilities', 'leadNationwide'],
    ['contractor_capabilities', 'leadPostcodeAreas'],
    ['service_jobs', 'workPostcodeArea'],
    ['service_jobs', 'sourceOfferId'],
    ['service_jobs', 'sourceAuctionId'],
    ['service_leads', 'anonymizedAt'],
    ['service_lead_recipients', 'matchSource'],
    ['service_lead_recipients', 'matchReason'],
    ['service_case_entries', 'storagePath'],
    ['service_case_entries', 'evidenceStatus'],
];

const requiredIndexes = [
    'contractor_capabilities_reviewed_by_idx',
    'service_capability_status_history_admin_idx',
    'service_job_vehicles_listing_idx',
    'service_leads_listing_idx',
    'service_payments_customer_idx',
    'service_quotes_submitted_by_idx',
    'service_settlement_operations_admin_idx',
    'service_settlement_operations_payment_idx',
    'trade_service_team_action_log_contractor_idx',
    'trade_service_team_action_log_dealer_idx',
];

/**
 * Read-only production schema gate.
 *
 * TradeXchange historically shipped some Supabase/manual migrations outside
 * Prisma's migration ledger. Until that history is reconciled, automatically
 * mutating production with prisma db push/migrate deploy is unsafe. This gate
 * prevents a backend release from starting against a database that is missing
 * the schema/security contract the current code expects.
 */
async function main() {
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tableSet = new Set(tables.map((row) => row.table_name));
    const missingTables = requiredTables.filter((name) => !tableSet.has(name));

    const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const columnSet = new Set(columns.map((row) => row.table_name + '.' + row.column_name));
    const missingColumns = requiredColumns
        .filter(([table, column]) => !columnSet.has(table + '.' + column))
        .map(([table, column]) => table + '.' + column);

    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
    );
    const indexSet = new Set(indexes.map((row) => row.indexname));
    const missingIndexes = requiredIndexes.filter((name) => !indexSet.has(name));

    const grants = await prisma.$queryRawUnsafe<Array<{
        table_name: string;
        grantee: string;
        privilege_type: string;
    }>>(
        "SELECT table_name, grantee, privilege_type " +
        "FROM information_schema.role_table_grants " +
        "WHERE table_schema = 'public' " +
        "AND grantee IN ('anon', 'authenticated') " +
        "AND table_name IN (" +
        "'service_jobs','service_job_vehicles','service_quotes','service_payments'," +
        "'service_leads','service_lead_recipients','service_case_entries','service_reviews'," +
        "'service_settlement_operations','service_payment_audit_events','service_capability_status_history'," +
        "'trade_service_team_permissions','trade_service_team_action_log','contractor_capabilities')",
    );

    if (missingTables.length || missingColumns.length || missingIndexes.length || grants.length) {
        console.error('TradeXchange schema verification failed.');
        if (missingTables.length) console.error('Missing tables:', missingTables.join(', '));
        if (missingColumns.length) console.error('Missing columns:', missingColumns.join(', '));
        if (missingIndexes.length) console.error('Missing indexes:', missingIndexes.join(', '));
        if (grants.length) {
            console.error(
                'Unexpected client grants:',
                grants.map((g) => g.grantee + ':' + g.table_name + ':' + g.privilege_type).join(', '),
            );
        }
        process.exitCode = 1;
        return;
    }

    console.log(
        'TradeXchange schema verified: ' + requiredTables.length + ' tables, ' +
        requiredColumns.length + ' critical columns, ' + requiredIndexes.length +
        ' FK indexes, no direct client grants on backend-only tables.',
    );
}

main()
    .catch((error) => {
        console.error('TradeXchange schema verification could not run:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
