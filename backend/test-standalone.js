const axios = require('axios');
const cheerio = require('cheerio');

async function testCarwow() {
    console.log('Fetching Carwow...');
    const url = 'https://www.carwow.co.uk/audi/q3/used';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        }
    });

    const $ = cheerio.load(response.data);
    const listings = [];

    $('[data-tracking-id="vehicle-card"]').each((i, el) => {
        const text = $(el).text();
        const priceText = $(el).find('[data-tracking-id="vehicle-price"]').text() || $(el).find('.price').text() || text;
        const matches = text.match(/£([\d,]+)/g);
        
        let extractedPrice = 0;
        const mainMatch = priceText.match(/£([\d,]+)/);
        if (mainMatch) {
            extractedPrice = parseInt(mainMatch[1].replace(/,/g, ''), 10);
        }

        console.log(`Card ${i} extracted price: £${extractedPrice}. All matches in text:`, matches);
        listings.push(extractedPrice);
    });
}
testCarwow();
