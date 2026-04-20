import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EstimatePriceDto } from './pricing.dto';
import OpenAI from 'openai';
import { ScraperService } from '../scraper/scraper.service';

@Injectable()
export class PricingService {
    private readonly logger = new Logger(PricingService.name);
    private openai: OpenAI;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private scraperService: ScraperService
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.openai = new OpenAI({ apiKey: apiKey || '' });
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not configured — Pricing AI will use fallback');
        }
    }

    async estimatePrice(dto: EstimatePriceDto) {
        try {
            // 1. Check cache first
            const cached = await this.prisma.priceEstimateCache.findFirst({
                where: {
                    make: dto.make,
                    model: dto.model,
                    year: dto.year,
                    mileage: dto.mileage,
                    fuelType: dto.fuelType || null,
                    transmission: dto.transmission || null,
                    condition: dto.condition || null,
                    expiresAt: { gt: new Date() }
                }
            });

            if (cached) {
                return {
                    low: Number(cached.estimateLow),
                    mid: Number(cached.estimateMid),
                    high: Number(cached.estimateHigh),
                    confidence: cached.confidence,
                    comparables: cached.comparables,
                    reasoning: "Retrieved from recent market analysis."
                };
            }

            // 2. Query market comparables
            let comparables = await this.prisma.marketPriceData.findMany({
                where: {
                    make: dto.make,
                    model: dto.model,
                    year: { gte: dto.year - 1, lte: dto.year + 1 },
                    mileage: { gte: dto.mileage - 20000, lte: dto.mileage + 20000 },
                    sourceUrl: { not: { contains: 'example' } }
                },
                take: 50,
                orderBy: { scrapedAt: 'desc' }
            });

            // 3. JIT Scraping on Cache Miss
            if (comparables.length < 3) {
                this.logger.log(`[JIT] Insufficient comparables (${comparables.length}) for ${dto.make} ${dto.model}. Triggering on-demand live scrape...`);
                
                try {
                    // Fetch live data directly from standard market engines
                    const results = await Promise.all([
                        this.scraperService.scrapeCarwow(dto.make, dto.model),
                        this.scraperService.scrapePulseCars(dto.make, dto.model)
                    ]);
                    
                    const allListings = results.flat();
                    if (allListings.length > 0) {
                        await this.scraperService.saveScrapedListings(allListings);
                        
                        // Re-query successfully populated data
                        comparables = await this.prisma.marketPriceData.findMany({
                            where: {
                                make: dto.make,
                                model: dto.model,
                                year: { gte: dto.year - 1, lte: dto.year + 1 },
                                mileage: { gte: dto.mileage - 20000, lte: dto.mileage + 20000 },
                                sourceUrl: { not: { contains: 'example' } }
                            },
                            take: 50,
                            orderBy: { scrapedAt: 'desc' }
                        });
                        this.logger.log(`[JIT] Newly fetched comparables: ${comparables.length}`);
                    }
                } catch (err) {
                    this.logger.warn(`[JIT] On-demand scrape failed, bypassing: ${err.message}`);
                }

                // If STILL less than 3 after a JIT scrape loop, fallback gracefully
                if (comparables.length < 3) {
                    return await this.calculateFallback(dto, comparables.length);
                }
            }

            const stats = this.aggregateComps(comparables);
            
            // 4. AI Refinement
            const aiEstimate = await this.getAiRefinedEstimate(dto, stats);

            // 5. Cache the result
            try {
                // TTL 24 hours
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);

                await this.prisma.priceEstimateCache.create({
                    data: {
                        make: dto.make,
                        model: dto.model,
                        year: dto.year,
                        mileage: dto.mileage,
                        fuelType: dto.fuelType,
                        transmission: dto.transmission,
                        condition: dto.condition,
                        location: dto.location,
                        estimateLow: aiEstimate.low,
                        estimateMid: aiEstimate.mid,
                        estimateHigh: aiEstimate.high,
                        comparables: stats.count,
                        confidence: aiEstimate.confidence,
                        expiresAt
                    }
                });
            } catch (err) {
                this.logger.warn('Failed to cache estimate:', err.message);
            }

            // Apply damage image penalty: every 2 damage photos = 1% deduction
            const damageCount = dto.damageImageCount || 0;
            const damagePenaltyPct = Math.floor(damageCount / 2);  // e.g. 5 photos = 2% penalty
            const damageMultiplier = 1 - (damagePenaltyPct / 100);

            const adjustedLow = Math.round((aiEstimate.low * damageMultiplier) / 100) * 100;
            const adjustedMid = Math.round((aiEstimate.mid * damageMultiplier) / 100) * 100;
            const adjustedHigh = Math.round((aiEstimate.high * damageMultiplier) / 100) * 100;

            return {
                low: adjustedLow,
                mid: adjustedMid,
                high: adjustedHigh,
                confidence: aiEstimate.confidence,
                comparables: stats.count,
                reasoning: aiEstimate.reasoning,
                damageDeduction: damagePenaltyPct > 0 ? damagePenaltyPct : undefined,
            };

        } catch (error) {
            this.logger.error('Error estimating price:', error);
            return await this.calculateFallback(dto, 0);
        }
    }

    private aggregateComps(listings: any[]) {
        const prices = listings.map(l => Number(l.price)).sort((a, b) => a - b);
        const n = prices.length;
        
        const medianOf = (arr: number[]) => {
            if (arr.length === 0) return 0;
            const s = [...arr].sort((a, b) => a - b);
            return s[Math.floor(s.length / 2)];
        };

        const autotraderPrices = listings.filter(l => l.source === 'AUTOTRADER').map(l => Number(l.price));
        const privatePrices = listings.filter(l => l.sellerType === 'PRIVATE').map(l => Number(l.price));
        const dealerPrices = listings.filter(l => l.sellerType === 'DEALER').map(l => Number(l.price));

        return {
            count: n,
            median: prices[Math.floor(n / 2)],
            p25: prices[Math.floor(n * 0.25)],
            p75: prices[Math.floor(n * 0.75)],
            minPrice: prices[0],
            maxPrice: prices[n - 1],
            autotraderMedian: medianOf(autotraderPrices),
            privateMedian: medianOf(privatePrices),
            dealerMedian: medianOf(dealerPrices),
        };
    }

    private async getAiRefinedEstimate(dto: EstimatePriceDto, stats: any) {
        if (!this.configService.get('OPENAI_API_KEY')) {
            // Mock AI behavior if key missing
            return {
                low: Math.round(stats.p25 / 100) * 100,
                mid: Math.round(stats.median / 100) * 100,
                high: Math.round(stats.p75 / 100) * 100,
                confidence: stats.count > 10 ? 0.8 : 0.5,
                reasoning: `Based on statistical analysis of ${stats.count} market listings.`
            };
        }

        const prompt = `You are an expert UK used-car valuation analyst for CarMazium.

Given the following vehicle details and market comparable data, provide an accurate price estimate.

VEHICLE TO VALUE:
- Make: ${dto.make}, Model: ${dto.model}, Year: ${dto.year}
- Mileage: ${dto.mileage} miles
- Fuel: ${dto.fuelType || 'Unknown'}, Transmission: ${dto.transmission || 'Unknown'}
- Condition: ${dto.condition || 'GOOD'}
- Location: ${dto.location || 'Unknown'}
- Damage photos uploaded: ${dto.damageImageCount || 0} (more photos indicate more visible damage)

MARKET DATA (from ${stats.count} comparable listings scraped in the last 30 days):
- Median asking price: £${stats.median}
- 25th percentile: £${stats.p25}
- 75th percentile: £${stats.p75}
- AutoTrader median: £${stats.autotraderMedian}
- Private seller median: £${stats.privateMedian}
- Dealer median: £${stats.dealerMedian}
- Price range: £${stats.minPrice} - £${stats.maxPrice}

INSTRUCTIONS:
1. Your calculation MUST be anchored to the provided MARKET DATA percentiles.
2. Consider standard UK mileage for this age (approx 8,000 miles/year). Adjust the value up or down slightly based on this specific vehicle's condition, mileage, and damage.
3. Do not drift significantly from the market median without establishing strong reasoning (e.g., exceptionally low mileage, or poor condition).

Respond ONLY in JSON:
{
    "low": <number>,
    "mid": <number>,
    "high": <number>,
    "confidence": <0.0-1.0 float>,
    "reasoning": "<1-2 sentence explanation>"
}`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0]?.message?.content?.trim();
            if (content) {
                return JSON.parse(content);
            }
        } catch (err) {
            this.logger.error('Failed to get AI refinement', err);
        }

        return {
            low: Math.round(stats.p25 / 100) * 100,
            mid: Math.round(stats.median / 100) * 100,
            high: Math.round(stats.p75 / 100) * 100,
            confidence: 0.5,
            reasoning: 'Fallback statistical estimation used.'
        };
    }

    private async calculateFallback(dto: EstimatePriceDto, count: number) {
        // Zero-Shot Native AI Fallback
        if (this.configService.get('OPENAI_API_KEY')) {
            const prompt = `You are a specialist UK car valuer. We have no direct web-scraped comparables for this exact vehicle right now. 
Please estimate the current UK Retail Asking Price (cash price) based on your extensive internal knowledge of the automotive market.

VEHICLE:
- Make: ${dto.make}, Model: ${dto.model}, Year: ${dto.year}
- Mileage: ${dto.mileage} miles
- Fuel: ${dto.fuelType || 'Unknown'}, Transmission: ${dto.transmission || 'Unknown'}
- Condition: ${dto.condition || 'GOOD'}

INSTRUCTIONS:
1. Categorise this vehicle's make into its market segment (Luxury, Premium, Standard, or Budget) and establish a realistic original brand-new MRRP in the UK.
2. Apply a realistic UK depreciation curve based on the vehicle's age.
3. Compare the mileage to the UK average of approximately 8,000 miles per year. Apply realistic penalties for above-average mileage and slight premiums for below-average mileage.

Respond ONLY in JSON with an estimated lower bound, middle average, and upper bound:
{
    "low": <number>,
    "mid": <number>,
    "high": <number>,
    "reasoning": "<1 sentence explanation connecting the specs to the valuation>"
}`;
            try {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                });
                
                const content = completion.choices[0]?.message?.content?.trim();
                if (content) {
                    const aiFallback = JSON.parse(content);
                    
                    // Apply exact same damage multipliers to AI zero-shot output
                    const damageCount = dto.damageImageCount || 0;
                    const damagePenaltyPct = Math.floor(damageCount / 2);
                    const damageMultiplier = 1 - (damagePenaltyPct / 100);

                    return {
                        low: Math.round((aiFallback.low * damageMultiplier) / 100) * 100,
                        mid: Math.round((aiFallback.mid * damageMultiplier) / 100) * 100,
                        high: Math.round((aiFallback.high * damageMultiplier) / 100) * 100,
                        confidence: 0.3, // 0.3 means zero-shot LLM (no local data, but smart)
                        comparables: count,
                        reasoning: "Zero-Shot AI Estimation: " + aiFallback.reasoning,
                        damageDeduction: damagePenaltyPct > 0 ? damagePenaltyPct : undefined,
                    };
                }
            } catch (e) {
                this.logger.error("AI Fallback failed. Using math.");
            }
        }

        // True last-resort math fallback if OpenAI is down or no key
        const makeKey = dto.make.toLowerCase();
        let fallbackBase = 25000;
        let depreciationRate = 0.15; // 15%

        const luxuryMakes = ['porsche', 'maserati', 'bentley', 'aston martin', 'ferrari', 'lamborghini', 'rolls-royce', 'mclaren'];
        const premiumMakes = ['bmw', 'mercedes-benz', 'mercedes', 'audi', 'land rover', 'range rover', 'jaguar', 'lexus', 'volvo', 'tesla', 'alfa romeo'];
        const budgetMakes = ['dacia', 'mg', 'suzuki', 'fiat', 'chevrolet', 'chrysler', 'ssangyong', 'proton'];

        if (luxuryMakes.includes(makeKey)) {
            fallbackBase = 60000;
            depreciationRate = 0.12;
        } else if (premiumMakes.includes(makeKey)) {
            fallbackBase = 40000;
            depreciationRate = 0.14;
        } else if (budgetMakes.includes(makeKey)) {
            fallbackBase = 15000;
            depreciationRate = 0.18;
        } else {
            fallbackBase = 25000;
            depreciationRate = 0.15;
        }

        const currentYear = new Date().getFullYear();
        const yearOffset = Math.max(0, currentYear - dto.year);
        let estimatedPrice = fallbackBase * Math.pow(1 - depreciationRate, yearOffset);

        // Mileage adjustment based on standard UK market logic (approx ~8,000 miles/yr)
        const expectedMileage = Math.max(1, yearOffset) * 8000;
        const mileageDifference = dto.mileage - expectedMileage;
        
        // Approx 4% reduction per 10k over, 2% premium per 10k under
        let mileageAdjustmentRate = 0;
        if (mileageDifference > 0) {
            mileageAdjustmentRate = -((mileageDifference / 10000) * 0.04);
        } else {
            mileageAdjustmentRate = (Math.abs(mileageDifference) / 10000) * 0.02;
        }

        // Cap the adjustment so it doesn't skew wildly (-50% to +20%)
        mileageAdjustmentRate = Math.max(-0.5, Math.min(0.2, mileageAdjustmentRate));
        estimatedPrice = estimatedPrice * (1 + mileageAdjustmentRate);

        estimatedPrice = Math.max(1000, estimatedPrice);

        const damageCount = dto.damageImageCount || 0;
        const damagePenaltyPct = Math.floor(damageCount / 2);
        const damageMultiplier = 1 - (damagePenaltyPct / 100);
        estimatedPrice = estimatedPrice * damageMultiplier;

        const mid = Math.round(estimatedPrice / 100) * 100;
        
        let segmentName = 'Standard';
        if (fallbackBase === 60000) segmentName = 'Luxury';
        if (fallbackBase === 40000) segmentName = 'Premium';
        if (fallbackBase === 15000) segmentName = 'Budget';

        return {
            low: Math.round(mid * 0.9 / 100) * 100,
            mid,
            high: Math.round(mid * 1.1 / 100) * 100,
            confidence: 0.1, // 0.1 means rigid math fallback (worst case)
            comparables: count,
            reasoning: `Insufficient market data. Mathematical baseline applied (${segmentName} Segment, adjusted for age and mileage).`,
            damageDeduction: damagePenaltyPct > 0 ? damagePenaltyPct : undefined,
        };
    }
}
