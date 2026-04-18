import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScrapedListing {
    source: string;
    make: string;
    model: string;
    variant?: string;
    year: number;
    mileage: number;
    price: number;
    fuelType?: string;
    transmission?: string;
    bodyType?: string;
    location?: string;
    sellerType?: string;
    sourceUrl?: string;
}

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);

    constructor(private prisma: PrismaService) {}

    async saveScrapedListings(listings: ScrapedListing[]) {
        if (!listings || listings.length === 0) return 0;
        
        let savedCount = 0;
        for (const listing of listings) {
            try {
                await this.prisma.marketPriceData.create({
                    data: {
                        source: listing.source,
                        make: listing.make,
                        model: listing.model,
                        variant: listing.variant,
                        year: listing.year,
                        mileage: listing.mileage,
                        price: listing.price,
                        fuelType: listing.fuelType,
                        transmission: listing.transmission,
                        bodyType: listing.bodyType,
                        location: listing.location,
                        sellerType: listing.sellerType,
                        sourceUrl: listing.sourceUrl,
                    }
                });
                savedCount++;
            } catch (error) {
                this.logger.error(`Failed to save listing from ${listing.source}: ${error.message}`);
            }
        }
        return savedCount;
    }

    // Mock implementations of Scraping functions
    async scrapeAutoTrader(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping AutoTrader for ${make} ${model}...`);
        return this.generateMockListings('AUTOTRADER', make, model, 15);
    }

    async scrapeMotors(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping Motors.co.uk for ${make} ${model}...`);
        return this.generateMockListings('MOTORS', make, model, 8);
    }

    async scrapeGumtree(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping Gumtree for ${make} ${model}...`);
        return this.generateMockListings('GUMTREE', make, model, 5);
    }

    async scrapeCarGurus(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping CarGurus for ${make} ${model}...`);
        return this.generateMockListings('CARGURUS', make, model, 7);
    }

    async scrapeCarwow(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping Carwow for ${make} ${model}...`);
        return this.generateMockListings('CARWOW', make, model, 4);
    }

    async scrapePulseCars(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Mock] Scraping PulseCars for ${make} ${model}...`);
        return this.generateMockListings('PULSECARS', make, model, 3);
    }

    private generateMockListings(source: string, make: string, model: string, count: number): ScrapedListing[] {
        const listings: ScrapedListing[] = [];
        const basePriceMatch = { "BMW": 41000, "AUDI": 41000, "FORD": 23000, "HONDA": 25000 }[make.toUpperCase()] || 25000;
        
        for (let i = 0; i < count; i++) {
            const yearOffset = Math.floor(Math.random() * 5); // 0 to 4 years old
            const year = new Date().getFullYear() - yearOffset;
            const mileage = 10000 + (yearOffset * 10000) + Math.floor(Math.random() * 5000);
            
            // Apply depreciation
            const depreciation = Math.pow(0.85, yearOffset);
            const rawPrice = basePriceMatch * depreciation;
            const price = Math.round((rawPrice + (Math.random() * 3000 - 1500)) / 100) * 100;
            
            const sellerType = Math.random() > 0.3 ? 'DEALER' : 'PRIVATE';
            const location = ['London', 'Birmingham', 'Manchester', 'Leeds'][Math.floor(Math.random() * 4)];

            listings.push({
                source,
                make,
                model,
                year,
                mileage,
                price,
                sellerType,
                location,
                fuelType: ['PETROL', 'DIESEL', 'HYBRID'][Math.floor(Math.random() * 3)],
                transmission: ['AUTOMATIC', 'MANUAL'][Math.floor(Math.random() * 2)],
                sourceUrl: `https://example-${source.toLowerCase()}-link.com`
            });
        }
        return listings;
    }
}
