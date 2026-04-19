require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function doIt() {
    const rawUrl = process.env.DATABASE_URL;
    const directUrl = rawUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '');
    
    console.log('Connecting cleanly to:', directUrl);
    
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: directUrl
            }
        }
    });

    try {
        const del = await prisma.marketPriceData.deleteMany({
            where: {
                sourceUrl: {
                    contains: 'example'
                }
            }
        });
        const delCache = await prisma.priceEstimateCache.deleteMany();
        console.log(`Successfully deleted ${del.count} mock rows and cleared the valuation cache.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
doIt();
