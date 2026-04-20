import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EstimatePriceDto } from './pricing.dto';
import OpenAI from 'openai';
import { ScraperService } from '../scraper/scraper.service';

// --- Segment classification ---
const MAKE_SEGMENT_MAP: Record<string, 'budget' | 'mainstream' | 'premium' | 'luxury'> = {
  dacia: 'budget', skoda: 'budget', seat: 'budget', vauxhall: 'budget',
  ford: 'budget', fiat: 'budget', renault: 'budget', peugeot: 'budget',
  citroen: 'budget', nissan: 'budget', hyundai: 'budget', kia: 'budget',
  suzuki: 'budget', mitsubishi: 'budget',

  volkswagen: 'mainstream', vw: 'mainstream', toyota: 'mainstream',
  honda: 'mainstream', mazda: 'mainstream', subaru: 'mainstream',
  volvo: 'mainstream', mini: 'mainstream',

  bmw: 'premium', mercedes: 'premium', 'mercedes-benz': 'premium',
  audi: 'premium', lexus: 'premium', jaguar: 'premium',
  'land rover': 'premium', 'range rover': 'premium', tesla: 'premium',

  porsche: 'luxury', maserati: 'luxury', bentley: 'luxury',
  'rolls-royce': 'luxury', 'aston martin': 'luxury',
  ferrari: 'luxury', lamborghini: 'luxury', mclaren: 'luxury',
};

const SEGMENT_CONFIG = {
  budget:     { base: 12000, annualDecay: 0.80, floor: 800  },
  mainstream: { base: 22000, annualDecay: 0.83, floor: 1500 },
  premium:    { base: 42000, annualDecay: 0.78, floor: 3000 },
  luxury:     { base: 95000, annualDecay: 0.72, floor: 8000 },
};

const FUEL_MULTIPLIERS: Record<string, number> = {
  ELECTRIC: 1.08,
  HYBRID:   1.04,
  PETROL:   1.00,
  DIESEL:   0.96, // market sentiment has softened diesel in the UK
};

const TRANSMISSION_MULTIPLIERS: Record<string, number> = {
  AUTOMATIC: 1.03,
  MANUAL:    1.00,
};

// --- Mileage deviation penalty ---
function getMileageMultiplier(mileage: number, ageYears: number): number {
  const expectedMileage = Math.max(1, ageYears) * 8000;
  const delta = mileage - expectedMileage;
  const per10k = delta / 10000;

  if (per10k <= 0) {
    return 1 + Math.min(0.08, Math.abs(per10k) * 0.02);
  } else {
    return 1 - Math.min(0.20, per10k * 0.03);
  }
}

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

        const currentYear = new Date().getFullYear();
        const expectedMileage = Math.max(0, currentYear - dto.year) * 8000;
        const mileageDelta = (dto.mileage ?? 0) - expectedMileage;
        
        const mileageNote = `- Mileage vs. UK average for this age: ${
          mileageDelta > 0
            ? `+${mileageDelta.toLocaleString()} (HIGH — discount from median accordingly)`
            : `${mileageDelta.toLocaleString()} (LOW — small premium justified)`
        }`;
        
        const damageNote = `- Damage photos uploaded: ${dto.damageImageCount ?? 0}${
          (dto.damageImageCount ?? 0) > 0
            ? ` — each pair of photos typically signals a separate damage area; apply a progressive discount from the median price.`
            : ' — no visible damage indicated.'
        }`;

        const prompt = `You are an expert UK used-car valuation analyst for CarMazium.

Given the following vehicle details and market comparable data, provide an accurate price estimate.

VEHICLE TO VALUE:
- Make: ${dto.make}, Model: ${dto.model}, Year: ${dto.year}
- Mileage: ${dto.mileage} miles
${mileageNote}
- Fuel: ${dto.fuelType || 'Unknown'}, Transmission: ${dto.transmission || 'Unknown'}
- Condition: ${dto.condition || 'GOOD'}
- Location: ${dto.location || 'Unknown'}
${damageNote}

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
            const currentYear = new Date().getFullYear();
            const expectedMileage = Math.max(0, currentYear - dto.year) * 8000;
            const mileageDelta = (dto.mileage ?? 0) - expectedMileage;
            const mileageContext = mileageDelta > 5000
                ? `HIGH mileage: ${mileageDelta.toLocaleString()} miles above UK average for this age — apply meaningful penalty.`
                : mileageDelta < -5000
                ? `LOW mileage: ${Math.abs(mileageDelta).toLocaleString()} miles below UK average for this age — slight premium applies.`
                : `Mileage is close to the UK average for this age (${expectedMileage.toLocaleString()} miles expected).`;

            const prompt = `You are a specialist UK used-car valuer. Today's date is ${new Date().toISOString().split('T')[0]}.
We have no direct web-scraped comparables for this vehicle right now.

Estimate the current UK Retail Asking Price (private sale / dealer forecourt cash price) using your knowledge of the UK automotive market.
UK average annual mileage is approximately 8,000 miles.

VEHICLE SPECS:
- Make: ${dto.make}, Model: ${dto.model}, Year: ${dto.year} (${currentYear - dto.year} years old)
- Mileage: ${dto.mileage?.toLocaleString()} miles — ${mileageContext}
- Fuel: ${dto.fuelType ?? 'Unknown'}, Transmission: ${dto.transmission ?? 'Unknown'}
- Condition: ${dto.condition ?? 'GOOD'}

Return ONLY valid JSON. No markdown, no explanation outside the JSON fields:
{
  "low": <integer — realistic lower bound>,
  "mid": <integer — most likely asking price>,
  "high": <integer — optimistic upper bound>,
  "reasoning": "<1 sentence linking key factors — age, mileage deviation, fuel type — to the valuation>"
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
        const makeKey = dto.make?.toLowerCase().trim() ?? '';
        const segment = Object.prototype.hasOwnProperty.call(MAKE_SEGMENT_MAP, makeKey) ? MAKE_SEGMENT_MAP[makeKey] : 'mainstream'; // safe default
        const config  = SEGMENT_CONFIG[segment];

        const currentYear = new Date().getFullYear();
        const age         = Math.max(0, currentYear - dto.year);

        // Age-based depreciation
        let estimated = config.base * Math.pow(config.annualDecay, age);
        estimated     = Math.max(config.floor, estimated);

        // Mileage deviation on top of age
        estimated *= getMileageMultiplier(dto.mileage ?? 0, age);

        // Fuel type
        const fuelKey = (dto.fuelType ?? 'PETROL').toUpperCase();
        estimated *= Object.prototype.hasOwnProperty.call(FUEL_MULTIPLIERS, fuelKey) ? FUEL_MULTIPLIERS[fuelKey] : 1.0;

        // Transmission
        const txKey = (dto.transmission ?? 'MANUAL').toUpperCase();
        estimated *= Object.prototype.hasOwnProperty.call(TRANSMISSION_MULTIPLIERS, txKey) ? TRANSMISSION_MULTIPLIERS[txKey] : 1.0;

        // Damage penalty
        const damageCount      = dto.damageImageCount ?? 0;
        const damagePenaltyPct = Math.floor(damageCount / 2);
        const damageMultiplier = 1 - damagePenaltyPct / 100;
        estimated *= damageMultiplier;

        const mid  = Math.round(estimated / 100) * 100;
        const low  = Math.round((mid * 0.88) / 100) * 100;
        const high = Math.round((mid * 1.12) / 100) * 100;

        return {
            low, mid, high,
            confidence: 0.15, // slightly more than 0.1 since it's now segment-aware
            comparables: count,
            reasoning: `Segmented mathematical estimate (${segment} class, ${age} year old vehicle, ${dto.mileage?.toLocaleString()} miles).`,
            damageDeduction: damagePenaltyPct > 0 ? damagePenaltyPct : undefined,
        };
    }
}
