require('dotenv').config();

async function purgeDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    console.log('Fetching corrupted market listings...');
    const result = await fetch(`${url}/rest/v1/market_price_data?select=id,sourceUrl`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });
    
    const rows = await result.json();
    
    const corruptedIds = rows.filter(r => r.sourceUrl && r.sourceUrl.includes('example')).map(r => r.id);
    console.log(`Found ${corruptedIds.length} mocked items to delete.`);
    
    for (const id of corruptedIds) {
        await fetch(`${url}/rest/v1/market_price_data?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
    }
    console.log(`Deletion Status: Complete.`);
}
purgeDB();
