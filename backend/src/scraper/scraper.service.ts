import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
        this.logger.log(`[Real] Scraping Carwow for ${make} ${model}...`);
        const listings: ScrapedListing[] = [];
        
        try {
            // Format to carwow standard: /make/model/used
            const formattedMake = make.toLowerCase().replace(/\s+/g, '-');
            const formattedModel = model.toLowerCase().replace(/\s+/g, '-');
            const url = `https://www.carwow.co.uk/${formattedMake}/${formattedModel}/used`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Loop through listing cards (adjusting selector based on generic semantic HTML)
            // Carwow usually has item containers with prices
            $('[data-tracking-id="vehicle-card"]').each((i, el) => {
                if (i >= 10) return false; // Limit to 10
                
                try {
                    const priceText = $(el).find('[data-tracking-id="vehicle-price"]').text() || $(el).find('.price').text() || '';
                    const mileageText = $(el).find('[data-tracking-id="vehicle-mileage"]').text() || $(el).text() || '';
                    const yearText = $(el).find('[data-tracking-id="vehicle-registration-year"]').text() || $(el).text() || '';
                    const link = $(el).find('a').attr('href');

                    const priceMatch = priceText.match(/£([\d,]+)/);
                    const mileageMatch = mileageText.match(/([\d,]+)\s*miles/i);
                    const yearMatch = yearText.match(/20\d{2}/);

                    if (priceMatch) {
                        listings.push({
                            source: 'CARWOW',
                            make,
                            model,
                            year: yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() - 3,
                            mileage: mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, '')) : 30000,
                            price: parseInt(priceMatch[1].replace(/,/g, '')),
                            sourceUrl: link ? (link.startsWith('http') ? link : `https://www.carwow.co.uk${link}`) : url,
                            sellerType: 'DEALER',
                        });
                    }
                } catch (e) {
                    // Skip malformed card
                }
            });

            // If empty (e.g. anti-bot block or DOM change), fallback cleanly
            if (listings.length === 0) {
                this.logger.warn(`No Carwow listings parsed. The DOM selector may have changed or the search returned 0 results.`);
                return [];
            }

            return listings;
        } catch (error) {
            this.logger.error(`Carwow scrape failed: ${error.message}`);
            return [];
        }
    }

    async scrapePulseCars(make: string, model: string): Promise<ScrapedListing[]> {
        this.logger.log(`[Real] Attempting to scrape PulseCars API for ${make} ${model}...`);
        
        try {
            // PulseCars is a React SPA without SSR listings. 
            // We'll attempt to hit its generic JSON endpoints or fallback to standard generation if it lacks an open API.
            const url = `https://pulsecars.co.uk/api/inventory?make=${make}&model=${model}`;
            
            const response = await axios.get(url, { timeout: 5000 });
            
            // Assume an array of inventory items
            if (response.data && Array.isArray(response.data.data)) {
                 return response.data.data.map((item: any) => ({
                     source: 'PULSECARS',
                     make,
                     model,
                     year: item.year || new Date().getFullYear() - 2,
                     mileage: item.mileage || 20000,
                     price: item.price,
                     sourceUrl: `https://pulsecars.co.uk/inventory/${item.id || ''}`,
                     sellerType: 'DEALER'
                 }));
            }
            
            throw new Error("Invalid API response format");

        } catch (error) {
            this.logger.warn(`PulseCars true API unavailable or 404. Proceeding without this source: ${error.message}`);
            return [];
        }
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
