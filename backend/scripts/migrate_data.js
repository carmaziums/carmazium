const { Client } = require('pg');

const OLD_DB_URL = "postgresql://postgres.qcqnllehtuczgammazwi:Gb6%40Jip%2Fe*xcVEq@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
const NEW_DB_URL = "postgresql://postgres:EcJXUwPUSpRE5OR7@db.bwtnzmevjlowwronylxm.supabase.co:5432/postgres";

const TABLES = [
    'users',
    'seller_profiles',
    'dealer_profiles',
    'contractor_profiles',
    'partner_profiles',
    'vehicles',
    'listings',
    'seller_reviews',
    'dealer_staff',
    'leads',
    'auctions',
    'bids',
    'service_requests',
    'finance_applications',
    'insurance_quotes',
    'transactions',
    'chat_rooms',
    'messages',
    'watchlist_items',
    'notifications',
    'analytics_events',
    'featured_boosts',
    'email_captures'
];

async function migrate() {
    const oldClient = new Client({ connectionString: OLD_DB_URL, ssl: { rejectUnauthorized: false } });
    const newClient = new Client({ connectionString: NEW_DB_URL, ssl: { rejectUnauthorized: false } });

    try {
        await oldClient.connect();
        await newClient.connect();
        console.log('Connected to both databases.');

        for (const table of TABLES) {
            console.log(`Migrating table: ${table}...`);
            
            // Get data from old
            const res = await oldClient.query(`SELECT * FROM public.${table}`);
            const rows = res.rows;
            console.log(`- Found ${rows.length} rows.`);

            if (rows.length === 0) continue;

            // Prepare for insertion into new
            const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
            const placeholders = Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO public.${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

            for (const row of rows) {
                const values = Object.values(row);
                await newClient.query(query, values);
            }
            console.log(`- Inserted ${rows.length} rows into ${table}.`);
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await oldClient.end();
        await newClient.end();
    }
}

migrate();
