import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EstimatePriceDto } from './pricing.dto';
import OpenAI from 'openai';

@Injectable()
export class PricingService {
    private readonly logger = new Logger(PricingService.name);
    private openai: OpenAI;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService
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
            const comparables = await this.prisma.marketPriceData.findMany({
                where: {
                    make: dto.make,
                    model: dto.model,
                    year: { gte: dto.year - 1, lte: dto.year + 1 },
                    mileage: { gte: dto.mileage - 20000, lte: dto.mileage + 20000 },
                },
                take: 50,
                orderBy: { scrapedAt: 'desc' }
            });

            // 3. Statistical Analysis
            if (comparables.length < 3) {
                // Not enough data, return fallback
                return this.calculateFallback(dto, comparables.length);
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
            return this.calculateFallback(dto, 0);
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

    private calculateFallback(dto: EstimatePriceDto, count: number) {
        // Super basic formula if no DB data
        const baseValues: Record<string, number> = {
            "PORSCHE": 68000, "LAND ROVER": 52000, "AUDI": 41000,
            "BMW": 41000, "MERCEDES": 41000, "FORD": 23000,
            "VOLKSWAGEN": 28000, "HONDA": 25000, "TOYOTA": 27000
        };
        const base = baseValues[dto.make.toUpperCase()] || 25000;
        const yearOffset = Math.max(0, new Date().getFullYear() - dto.year);
        
        let estimatedPrice = base * Math.pow(0.85, yearOffset);
        estimatedPrice = Math.max(1000, estimatedPrice);

        // Apply damage penalty to fallback too
        const damageCount = dto.damageImageCount || 0;
        const damagePenaltyPct = Math.floor(damageCount / 2);
        const damageMultiplier = 1 - (damagePenaltyPct / 100);
        estimatedPrice = estimatedPrice * damageMultiplier;

        const mid = Math.round(estimatedPrice / 100) * 100;
        return {
            low: Math.round(mid * 0.9 / 100) * 100,
            mid,
            high: Math.round(mid * 1.1 / 100) * 100,
            confidence: 0.1,
            comparables: count,
            reasoning: "Insufficient market data. Used fallback depreciation formula.",
            damageDeduction: damagePenaltyPct > 0 ? damagePenaltyPct : undefined,
        };
    }
}
