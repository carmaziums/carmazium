import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkT() {
   const latest = await prisma.marketPriceData.findMany({
       take: 15,
       orderBy: { scrapedAt: 'desc' }
   });
   console.log("Latest scraped items:");
   for(const item of latest){
      console.log(`[${item.source}] ${item.make} ${item.model} (${item.year}) - £${item.price} - ${item.mileage}mi`);
   }
}
checkT().finally(() => prisma.$disconnect());
