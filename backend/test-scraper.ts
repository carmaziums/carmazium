import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScraperService } from './src/scraper/scraper.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scraperService = app.get(ScraperService);
  
  console.log('Testing Carwow Scrape:');
  const carwowData = await scraperService.scrapeCarwow('Audi', 'Q3 Sportback');
  console.log(carwowData);

  console.log('Testing PulseCars Scrape:');
  const pulseCarsData = await scraperService.scrapePulseCars('BMW', '1 Series');
  console.log(pulseCarsData);

  await app.close();
}

bootstrap();
