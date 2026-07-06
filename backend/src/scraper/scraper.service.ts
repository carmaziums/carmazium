import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedListing {
    platform: 'AUTOTRADER' | 'CARGURUS' | 'CARWOW';
    originalUrl: string;
    title: string;
    price?: number;
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    fuelType?: string;
    transmission?: string;
    color?: string;
    bodyType?: string;
    doors?: number;
    engineSize?: number;
    bhp?: number;
    description?: string;
    images: string[];
    location?: string;
    vrm?: string;
    vin?: string;
}

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);

    constructor(private readonly config: ConfigService) {}

    detectPlatform(url: string): 'AUTOTRADER' | 'CARGURUS' | 'CARWOW' | 'UNKNOWN' {
        try {
            const { hostname } = new URL(url);
            if (hostname.includes('autotrader.co.uk')) return 'AUTOTRADER';
            if (hostname.includes('cargurus.co.uk')) return 'CARGURUS';
            if (hostname.includes('carwow.co.uk')) return 'CARWOW';
        } catch {}
        return 'UNKNOWN';
    }

    private normaliseUrl(url: string): string {
        try {
            const u = new URL(url);
            // Strip tracking/session params — keep only the path
            return `${u.origin}${u.pathname}`;
        } catch {
            return url;
        }
    }

    async scrape(url: string): Promise<ScrapedListing> {
        const platform = this.detectPlatform(url);
        if (platform === 'UNKNOWN') {
            throw new Error('Unsupported platform. Paste a link from autotrader.co.uk, cargurus.co.uk, or carwow.co.uk.');
        }

        const cleanUrl = this.normaliseUrl(url);

        switch (platform) {
            case 'CARGURUS': return this.scrapeCarGurus(cleanUrl);
            case 'AUTOTRADER': return this.scrapeViaScrapingBee('AUTOTRADER', cleanUrl);
            case 'CARWOW': return this.scrapeViaScrapingBee('CARWOW', cleanUrl);
        }
    }

    // ─── CarGurus ─────────────────────────────────────────────────────────────
    // SSR page, no anti-bot protection on detail pages — plain HTTP works.

    private async scrapeCarGurus(url: string): Promise<ScrapedListing> {
        // Prefer ScrapingBee even for CarGurus — datacenter IPs get 406'd
        const apiKey = this.config.get<string>('SCRAPINGBEE_API_KEY');
        if (apiKey) {
            return this.scrapeViaScrapingBee('CARGURUS', url);
        }

        let html: string;
        try {
            const { data } = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-GB,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'max-age=0',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'Connection': 'keep-alive',
                },
            });
            html = data;
        } catch (e: any) {
            throw new Error(`Failed to fetch CarGurus listing: ${e.message}`);
        }

        const $ = cheerio.load(html);

        // Strategy 1: JSON-LD
        const jsonLd = this.extractJsonLd($);
        if (jsonLd) {
            return this.normaliseJsonLd('CARGURUS', url, jsonLd, $);
        }

        // Strategy 2: Open Graph + DOM parsing
        const ogTitle = $('meta[property="og:title"]').attr('content') ?? $('title').text().split('|')[0].trim();
        const ogDescription = $('meta[property="og:description"]').attr('content') ?? '';
        const ogImage = $('meta[property="og:image"]').attr('content');

        // Pull all visible text for regex-based extraction
        const bodyText = $.text();

        const price = this.extractPrice($, bodyText);
        const mileage = this.extractMileage(bodyText);
        const year = this.extractYear(ogTitle + ' ' + bodyText);
        const { make, model } = this.parseMakeModel(ogTitle);

        const images = this.extractImages($, url, ogImage);

        const specs = this.extractSpecsCarGurus($, bodyText);

        return {
            platform: 'CARGURUS',
            originalUrl: url,
            title: ogTitle || 'Imported from CarGurus',
            price,
            make,
            model,
            year,
            mileage,
            description: ogDescription || undefined,
            images,
            ...specs,
        };
    }

    // ─── AutoTrader / CarWow via ScrapingBee ─────────────────────────────────

    private async scrapeViaScrapingBee(
        platform: 'AUTOTRADER' | 'CARGURUS' | 'CARWOW',
        url: string,
    ): Promise<ScrapedListing> {
        const apiKey = this.config.get<string>('SCRAPINGBEE_API_KEY');
        if (!apiKey) {
            const platformName = platform === 'AUTOTRADER' ? 'AutoTrader' : platform === 'CARWOW' ? 'CarWow' : 'CarGurus';
            throw new Error(
                `${platformName} listings require a ScrapingBee API key to scrape reliably. ` +
                'Please set SCRAPINGBEE_API_KEY in your environment.',
            );
        }

        let html: string;
        try {
            const { data } = await axios.get('https://app.scrapingbee.com/api/v1/', {
                timeout: 30000,
                params: {
                    api_key: apiKey,
                    url,
                    render_js: platform === 'AUTOTRADER' ? 'true' : 'false',
                    premium_proxy: 'true',
                    country_code: 'gb',
                },
            });
            html = data;
        } catch (e: any) {
            throw new Error(`Failed to fetch ${platform} listing via ScrapingBee: ${e.message}`);
        }

        const $ = cheerio.load(html);

        // Try JSON-LD first (AutoTrader embeds schema.org/Car)
        const jsonLd = this.extractJsonLd($);
        if (jsonLd) {
            return this.normaliseJsonLd(platform, url, jsonLd, $);
        }

        // Fall back to DOM parsing
        const ogTitle = $('meta[property="og:title"]').attr('content') ?? $('h1').first().text().trim();
        const ogImage = $('meta[property="og:image"]').attr('content');
        const bodyText = $.text();

        const price = this.extractPrice($, bodyText);
        const mileage = this.extractMileage(bodyText);
        const year = this.extractYear(ogTitle + ' ' + bodyText);
        const { make, model } = this.parseMakeModel(ogTitle);
        const images = this.extractImages($, url, ogImage);
        const specs = this.extractSpecsGeneric(bodyText);

        return {
            platform,
            originalUrl: url,
            title: ogTitle || `Imported from ${platform === 'AUTOTRADER' ? 'AutoTrader' : 'CarWow'}`,
            price,
            make,
            model,
            year,
            mileage,
            images,
            ...specs,
        };
    }

    // ─── JSON-LD extraction ───────────────────────────────────────────────────

    private extractJsonLd($: cheerio.CheerioAPI): any | null {
        let found: any = null;
        $('script[type="application/ld+json"]').each((_, el) => {
            if (found) return;
            try {
                const json = JSON.parse($(el).html() ?? '');
                const items = Array.isArray(json) ? json : [json];
                for (const item of items) {
                    if (item['@type'] === 'Car' || item['@type'] === 'Vehicle' || item['@type'] === 'Product') {
                        found = item;
                        return false;
                    }
                }
            } catch {}
        });
        return found;
    }

    private normaliseJsonLd(
        platform: 'AUTOTRADER' | 'CARGURUS' | 'CARWOW',
        url: string,
        ld: any,
        $: cheerio.CheerioAPI,
    ): ScrapedListing {
        const bodyText = $.text();
        const rawPrice = ld.offers?.price ?? ld.price;
        const price = rawPrice ? Math.round(Number(rawPrice)) : this.extractPrice($, bodyText);
        const name = ld.name ?? ld.title ?? '';
        const { make, model } = this.parseMakeModel(name, ld.brand?.name, ld.model);

        const images: string[] = [];
        if (ld.image) {
            (Array.isArray(ld.image) ? ld.image : [ld.image]).forEach((img: any) => {
                const src = typeof img === 'string' ? img : img.url ?? img.contentUrl;
                if (src) images.push(src);
            });
        }
        if (images.length === 0) {
            const og = $('meta[property="og:image"]').attr('content');
            if (og) images.push(og);
        }

        return {
            platform,
            originalUrl: url,
            title: name || `Imported from ${platform}`,
            price,
            make,
            model,
            year: ld.vehicleModelDate ? parseInt(ld.vehicleModelDate) : this.extractYear(name + ' ' + bodyText),
            mileage: ld.mileageFromOdometer?.value ? Math.round(Number(ld.mileageFromOdometer.value)) : this.extractMileage(bodyText),
            fuelType: this.normaliseFuel(ld.fuelType ?? ''),
            transmission: this.normaliseTransmission(ld.vehicleTransmission ?? ''),
            color: ld.color ?? undefined,
            bodyType: this.normaliseBodyType(ld.bodyType ?? ''),
            description: ld.description ?? undefined,
            images,
            vrm: ld.vehicleIdentificationNumber ? undefined : ld.license ?? undefined,
            vin: ld.vehicleIdentificationNumber ?? undefined,
        };
    }

    // ─── CarGurus-specific DOM extraction ────────────────────────────────────

    private extractSpecsCarGurus($: cheerio.CheerioAPI, bodyText: string): Partial<ScrapedListing> {
        const specs: Partial<ScrapedListing> = {};

        // CarGurus renders specs in a definition-list or table — try multiple selectors
        const specText = bodyText;

        specs.fuelType = this.normaliseFuel(this.extractSpecValue(specText, ['Fuel type', 'Fuel Type', 'Fuel']));
        specs.transmission = this.normaliseTransmission(this.extractSpecValue(specText, ['Transmission', 'Gearbox']));
        specs.color = this.extractSpecValue(specText, ['Colour', 'Color', 'Exterior colour']) || undefined;
        specs.bodyType = this.normaliseBodyType(this.extractSpecValue(specText, ['Body type', 'Body Type', 'Body style']));
        specs.doors = this.extractNumericSpec(specText, ['Doors']);
        specs.bhp = this.extractNumericSpec(specText, ['bhp', 'BHP', 'PS', 'hp']);
        specs.engineSize = this.extractEngineSize(specText);
        specs.location = this.extractLocation($);

        return specs;
    }

    private extractSpecsGeneric(bodyText: string): Partial<ScrapedListing> {
        return {
            fuelType: this.normaliseFuel(this.extractSpecValue(bodyText, ['Fuel type', 'Fuel Type', 'Fuel'])),
            transmission: this.normaliseTransmission(this.extractSpecValue(bodyText, ['Transmission', 'Gearbox'])),
            bodyType: this.normaliseBodyType(this.extractSpecValue(bodyText, ['Body type', 'Body Type', 'Body style'])),
            doors: this.extractNumericSpec(bodyText, ['Doors']),
            bhp: this.extractNumericSpec(bodyText, ['BHP', 'PS', 'hp']),
            engineSize: this.extractEngineSize(bodyText),
        };
    }

    // ─── Shared extractors ────────────────────────────────────────────────────

    private extractPrice($: cheerio.CheerioAPI, bodyText: string): number | undefined {
        // Look for £[digits] pattern — pick the largest value that looks like a car price
        const matches = bodyText.match(/£\s*([\d,]+)/g) ?? [];
        const prices = matches
            .map(m => parseInt(m.replace(/[£,\s]/g, '')))
            .filter(p => p >= 500 && p <= 2_000_000);
        return prices.length > 0 ? Math.max(...prices) : undefined;
    }

    private extractMileage(bodyText: string): number | undefined {
        // "22,478 miles" or "22478 miles"
        const m = bodyText.match(/([\d,]+)\s*miles/i);
        if (m) return parseInt(m[1].replace(/,/g, ''));
        return undefined;
    }

    private extractYear(text: string): number | undefined {
        // Find 4-digit year between 1990 and current+1
        const now = new Date().getFullYear() + 1;
        const m = text.match(/\b(199\d|20[0-2]\d)\b/);
        if (m) {
            const y = parseInt(m[1]);
            if (y >= 1990 && y <= now) return y;
        }
        return undefined;
    }

    private extractImages($: cheerio.CheerioAPI, baseUrl: string, ogImage?: string): string[] {
        const images: string[] = [];
        const seen = new Set<string>();

        const addImage = (src: string) => {
            if (!src || seen.has(src)) return;
            // Skip tiny icons, data URIs, SVGs
            if (src.startsWith('data:') || src.endsWith('.svg') || src.includes('icon')) return;
            seen.add(src);
            images.push(src);
        };

        $('img').each((_, el) => {
            const src = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-lazy-src');
            if (src && (src.includes('http') || src.startsWith('/'))) {
                addImage(src.startsWith('/') ? new URL(src, baseUrl).href : src);
            }
        });

        if (ogImage) addImage(ogImage);

        // Filter: must be large-ish image URLs (skip thumbnails < 50px in name)
        return images.filter(src => !src.match(/(\d+x\d+|thumb|icon|logo|avatar)/i)).slice(0, 20);
    }

    private extractLocation($: cheerio.CheerioAPI): string | undefined {
        const text = $('[class*="location"], [class*="dealer"], [data-testid*="location"]').first().text().trim();
        return text || undefined;
    }

    private parseMakeModel(
        title: string,
        ldBrand?: string,
        ldModel?: string,
    ): { make?: string; model?: string } {
        if (ldBrand && ldModel) return { make: ldBrand, model: ldModel };

        // Common UK makes — check if title starts with one
        const makes = [
            'Audi', 'BMW', 'Ford', 'Vauxhall', 'Volkswagen', 'VW', 'Mercedes', 'Mercedes-Benz',
            'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Peugeot', 'Renault', 'Seat',
            'Skoda', 'Volvo', 'Land Rover', 'Jaguar', 'Porsche', 'Ferrari', 'Lamborghini',
            'Maserati', 'Alfa Romeo', 'Fiat', 'Mitsubishi', 'Subaru', 'Suzuki', 'Mazda',
            'Lexus', 'Infiniti', 'Jeep', 'Chrysler', 'Dodge', 'Chevrolet', 'Tesla',
            'Mini', 'MINI', 'MG', 'Dacia', 'Citroen', 'DS', 'Cupra', 'Genesis',
        ];

        const t = title.trim();
        for (const make of makes) {
            if (t.toLowerCase().startsWith(make.toLowerCase())) {
                const rest = t.slice(make.length).trim();
                const modelPart = rest.split(/\s+/).slice(0, 2).join(' ');
                return { make, model: modelPart || undefined };
            }
        }

        const parts = t.split(/\s+/);
        return {
            make: parts[0] ?? undefined,
            model: parts.slice(1, 3).join(' ') || undefined,
        };
    }

    private extractSpecValue(text: string, labels: string[]): string {
        for (const label of labels) {
            const re = new RegExp(`${label}[:\\s]+([A-Za-z0-9][^\\n\\r]{1,40})`, 'i');
            const m = text.match(re);
            if (m) return m[1].trim().split(/\s{2,}/)[0].trim();
        }
        return '';
    }

    private extractNumericSpec(text: string, labels: string[]): number | undefined {
        for (const label of labels) {
            const re = new RegExp(`(\\d+(?:,\\d+)?)\\s*${label}\\b`, 'i');
            const m = text.match(re);
            if (m) return parseInt(m[1].replace(/,/g, ''));
        }
        return undefined;
    }

    private extractEngineSize(text: string): number | undefined {
        // "1.8L" -> 1800, "2.0" -> 2000, "2993cc"
        const cc = text.match(/(\d+)\s*cc/i);
        if (cc) return parseInt(cc[1]);
        const litres = text.match(/(\d+\.?\d*)\s*(?:L|litre|liter)\b/i);
        if (litres) return Math.round(parseFloat(litres[1]) * 1000);
        return undefined;
    }

    // ─── Normalisation helpers ────────────────────────────────────────────────

    private normaliseFuel(raw: string): string | undefined {
        if (!raw) return undefined;
        const lower = raw.toLowerCase();
        if (lower.includes('bi-fuel') || lower.includes('bi fuel') || lower.includes('bifuel')) return 'BI_FUEL';
        if (lower.includes('natural gas') || lower.includes('cng') || (lower.includes('gas') && !lower.includes('gasoline'))) return 'NATURAL_GAS';
        if (lower.includes('hybrid') && lower.includes('plug')) {
            if (lower.includes('diesel')) return 'DIESEL_PLUGIN_HYBRID';
            if (lower.includes('petrol')) return 'PETROL_PLUGIN_HYBRID';
            return 'PLUGIN_HYBRID';
        }
        if (lower.includes('hybrid')) {
            if (lower.includes('diesel')) return 'DIESEL_HYBRID';
            if (lower.includes('petrol')) return 'PETROL_HYBRID';
            return 'HYBRID';
        }
        if (lower.includes('petrol')) return 'PETROL';
        if (lower.includes('diesel')) return 'DIESEL';
        if (lower.includes('electric')) return 'ELECTRIC';
        if (lower.includes('lpg')) return 'LPG';
        if (lower.includes('hydrogen')) return 'HYDROGEN_CELL';
        return undefined;
    }

    private normaliseTransmission(raw: string): string | undefined {
        if (!raw) return undefined;
        const lower = raw.toLowerCase();
        if (lower.includes('automatic')) return 'AUTOMATIC';
        if (lower.includes('manual')) return 'MANUAL';
        if (lower.includes('cvt')) return 'CVT';
        if (lower.includes('semi')) return 'SEMI_AUTOMATIC';
        return undefined;
    }

    private normaliseBodyType(raw: string): string | undefined {
        if (!raw) return undefined;
        const lower = raw.toLowerCase();
        if (lower.includes('suv') || lower.includes('4x4') || lower.includes('crossover')) return 'SUV';
        if (lower.includes('hatchback')) return 'HATCHBACK';
        if (lower.includes('estate') || lower.includes('wagon')) return 'ESTATE';
        if (lower.includes('saloon') || lower.includes('sedan')) return 'SEDAN';
        if (lower.includes('coupe') || lower.includes('coupé')) return 'COUPE';
        if (lower.includes('convertible') || lower.includes('cabriolet')) return 'CONVERTIBLE';
        if (lower.includes('mpv') || lower.includes('people carrier')) return 'MPV';
        if (lower.includes('pickup') || lower.includes('pick-up')) return 'PICKUP_TRUCK';
        if (lower.includes('van')) return 'VAN';
        return undefined;
    }
}
