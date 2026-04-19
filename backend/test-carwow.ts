import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScraperService } from './src/scraper/scraper.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const scraper = app.get(ScraperService);
  
  console.log('Testing Carwow scraper...');
  // We mock the DB context or just bypass it since we only care about scrapeCarwow output
  const data = await scraper.scrapeCarwow('Audi', 'Q3 Sportback');
  console.log('Carwow prices:');
  console.log(data.map(d => d.price));
  
  await app.close();
  process.exit(0);
}

bootstrap();
