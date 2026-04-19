import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScraperCron } from './src/scraper/scraper.cron';

async function bootstrap() {
  console.log('Initializing application context to run scraper...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  
  const cron = app.get(ScraperCron);
  
  await cron.handleCron();
  
  console.log('Scrape finished. Closing app context...');
  await app.close();
  process.exit(0);
}

bootstrap().catch(err => {
    console.error(err);
    process.exit(1);
});
