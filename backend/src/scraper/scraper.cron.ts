import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

@Injectable()
export class ScraperCron {
    private readonly logger = new Logger(ScraperCron.name);

    constructor(private scraperService: ScraperService) {}

    // Runs once a week on Sunday at 00:00
    @Cron('0 0 * * 0')
    async handleCron() {
        this.logger.log('Starting scheduled web scraping of market prices...');

        // Top 5 models to demonstrate scraping prioritization
        const targets = [
            { make: 'BMW', model: '3 Series' },
            { make: 'AUDI', model: 'A3' },
            { make: 'FORD', model: 'Fiesta' },
            { make: 'VOLKSWAGEN', model: 'Golf' },
            { make: 'MERCEDES-BENZ', model: 'C-Class' },
        ];

        let totalSaved = 0;

        for (const target of targets) {
            this.logger.log(`Scraping target: ${target.make} ${target.model}`);
            
            try {
                const results = await Promise.all([
                    this.scraperService.scrapeAutoTrader(target.make, target.model),
                    this.scraperService.scrapeMotors(target.make, target.model),
                    this.scraperService.scrapeGumtree(target.make, target.model),
                    this.scraperService.scrapeCarGurus(target.make, target.model),
                    this.scraperService.scrapeCarwow(target.make, target.model),
                    this.scraperService.scrapePulseCars(target.make, target.model),
                ]);

                // Flatten and save
                const allListings = results.flat();
                const saved = await this.scraperService.saveScrapedListings(allListings);
                totalSaved += saved;
            } catch (err) {
                this.logger.error(`Error scraping ${target.make} ${target.model}:`, err.message);
            }

            // Simple throttle between makes to avoid slamming endpoints continuously
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        this.logger.log(`Scraping cycle complete. Saved ${totalSaved} listings.`);
    }
}
