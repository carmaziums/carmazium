require('dotenv').config();

async function checkRest() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    console.log('Fetching...');
    const result = await fetch(`${url}/rest/v1/market_price_data?select=id,sourceUrl&limit=100`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });
    
    const text = await result.text();
    console.log('Response:', text.substring(0, 500));
}
checkRest();
