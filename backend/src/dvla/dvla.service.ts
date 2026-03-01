import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';

// ─── DVLA VES API Response ────────────────────────────────────────────────────

export interface DvlaVehicleResponse {
    registrationNumber: string;
    make?: string;
    colour?: string;
    yearOfManufacture?: number;
    engineCapacity?: number;
    co2Emissions?: number;
    fuelType?: string;
    motStatus?: string;
    taxStatus?: string;
    typeApproval?: string;
    wheelplan?: string;
    revenueWeight?: number;
    dateOfLastV5CIssued?: string;
    euroStatus?: string;
    realDrivingEmissions?: string;
    markedForExport?: boolean;
    firstUsedDate?: string;
    manufactureDate?: string;
    monthOfFirstRegistration?: string;
}

// ─── Mapped lookup result returned to the frontend ────────────────────────────

export interface DvlaLookupResult {
    vrm: string;
    make?: string;
    colour?: string;
    year?: number;
    engineSize?: number;      // cc
    co2Emissions?: number;    // g/km
    fuelType?: string;        // mapped to our FuelType enum string
    euroStandard?: string;    // mapped to our EuroStandard enum string
    motStatus?: string;
    taxStatus?: string;
    // ── Bonus fields (CarCheck fallback can supply these) ─────────────────────
    model?: string;
    mileage?: number;
    transmission?: string;    // MANUAL | AUTOMATIC | SEMI_AUTOMATIC
    bodyType?: string;        // mapped to our BodyType enum string
    doors?: number;
    dataSource?: 'DVLA' | 'CARCHECK';
}

// ─── Fuel type mapping (DVLA values → our enum) ────────────────────────────────

const DVLA_FUEL_MAP: Record<string, string> = {
    PETROL: 'PETROL',
    DIESEL: 'DIESEL',
    'ELECTRIC': 'ELECTRIC',
    'HYBRID ELECTRIC': 'HYBRID',
    'PLUG-IN HYBRID ELECTRIC': 'PLUGIN_HYBRID',
    'GAS/PETROL': 'PETROL',
    'GAS/DIESEL': 'DIESEL',
};

// ─── Euro status mapping (DVLA values → our enum) ─────────────────────────────

const DVLA_EURO_MAP: Record<string, string> = {
    EURO4: 'EURO_4',
    EURO5: 'EURO_5',
    EURO6: 'EURO_6',
    EURO6D: 'EURO_6D',
    'EURO 4': 'EURO_4',
    'EURO 5': 'EURO_5',
    'EURO 6': 'EURO_6',
    'EURO 6D': 'EURO_6D',
};

// ─── CarCheck fuel mapping ────────────────────────────────────────────────────

const CC_FUEL_MAP: Record<string, string> = {
    'petrol': 'PETROL',
    'diesel': 'DIESEL',
    'electric': 'ELECTRIC',
    'hybrid electric (clean)': 'HYBRID',
    'hybrid': 'HYBRID',
    'plug-in hybrid': 'PLUGIN_HYBRID',
    'gas': 'PETROL',
};

// ─── CarCheck gearbox mapping ─────────────────────────────────────────────────

const CC_GEARBOX_MAP: Record<string, string> = {
    'manual': 'MANUAL',
    'automatic': 'AUTOMATIC',
    'semi-automatic': 'SEMI_AUTOMATIC',
    'cvt': 'AUTOMATIC',
};

// ─── Endpoints ────────────────────────────────────────────────────────────────

const DVLA_PROD_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const CARCHECK_BASE = 'https://www.carcheck.co.uk';

@Injectable()
export class DvlaService {
    private readonly logger = new Logger(DvlaService.name);
    private readonly apiKey: string | undefined;
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('DVLA_API_KEY');
        this.baseUrl = this.configService.get<string>('DVLA_API_URL') ?? DVLA_PROD_URL;

        if (!this.apiKey) {
            this.logger.warn('DVLA_API_KEY is not set — will use CarCheck.co.uk fallback for VRM lookup');
        }
        this.logger.log(`DVLA endpoint: ${this.baseUrl}`);
    }

    // ─── Public entry point ───────────────────────────────────────────────────

    async lookupVrm(vrm: string): Promise<DvlaLookupResult> {
        const normalised = vrm.replace(/\s+/g, '').toUpperCase();

        if (!/^[A-Z0-9]{2,7}$/.test(normalised)) {
            throw new BadRequestException(`Invalid UK registration number: "${vrm}"`);
        }

        // 1. Try DVLA first (if API key is configured)
        if (this.apiKey) {
            try {
                return await this.dvlaRequest(normalised);
            } catch (err: any) {
                const isNotFound =
                    err?.status === 404 ||
                    err?.message?.includes('not found') ||
                    err?.response?.status === 404;

                if (isNotFound) {
                    this.logger.warn(`DVLA: vehicle ${normalised} not found — trying CarCheck fallback`);
                } else {
                    this.logger.warn(`DVLA error for ${normalised}: ${err?.message} — trying CarCheck fallback`);
                }
            }
        }

        // 2. CarCheck.co.uk scraping fallback
        const ccResult = await this.carcheckLookup(normalised);
        if (ccResult) {
            return ccResult;
        }

        // 3. Neither source has the vehicle
        throw new BadRequestException(
            `Vehicle not found for registration: ${normalised}. Please fill in the details manually.`,
        );
    }

    // ─── DVLA REST request ────────────────────────────────────────────────────

    private async dvlaRequest(normalised: string): Promise<DvlaLookupResult> {
        this.logger.log(`DVLA lookup for VRM: ${normalised}`);

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ registrationNumber: normalised }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new BadRequestException(`Vehicle not found for registration: ${normalised}`);
            }
            const text = await response.text().catch(() => '');
            this.logger.error(`DVLA API error ${response.status}: ${text}`);
            throw new ServiceUnavailableException(`DVLA API returned ${response.status}`);
        }

        const data: DvlaVehicleResponse = await response.json();

        return {
            vrm: data.registrationNumber,
            make: data.make,
            colour: data.colour,
            year: data.yearOfManufacture,
            engineSize: data.engineCapacity,
            co2Emissions: data.co2Emissions,
            fuelType: data.fuelType ? DVLA_FUEL_MAP[data.fuelType.toUpperCase()] : undefined,
            euroStandard: data.euroStatus ? DVLA_EURO_MAP[data.euroStatus.toUpperCase()] : undefined,
            motStatus: data.motStatus,
            taxStatus: data.taxStatus,
            dataSource: 'DVLA',
        };
    }

    // ─── CarCheck.co.uk HTML scraping fallback ────────────────────────────────

    private async carcheckLookup(normalised: string): Promise<DvlaLookupResult | null> {
        try {
            this.logger.log(`CarCheck fallback lookup for VRM: ${normalised}`);

            const url = `${CARCHECK_BASE}/${normalised}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-GB,en;q=0.9',
                },
            });

            if (!response.ok) {
                this.logger.warn(`CarCheck returned ${response.status} for ${normalised}`);
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // CarCheck uses <th> for labels and <td> for values in table rows
            // Extract all key-value pairs from tables
            const data: Record<string, string> = {};

            $('table tr').each((_i, row) => {
                const th = $(row).find('th');
                const td = $(row).find('td');

                // Pattern 1: <th>Label</th><td>Value</td>
                if (th.length >= 1 && td.length >= 1) {
                    const label = $(th[0]).text().trim().toLowerCase();
                    const value = $(td[0]).text().trim();
                    if (label && value && value !== '-') {
                        data[label] = value;
                    }
                }
                // Pattern 2: <td>Label</td><td>Value</td> (fallback)
                else if (td.length >= 2) {
                    const label = $(td[0]).text().trim().toLowerCase();
                    const value = $(td[1]).text().trim();
                    if (label && value && value !== '-') {
                        data[label] = value;
                    }
                }
            });

            this.logger.log(`CarCheck raw data keys: ${Object.keys(data).join(', ')}`);

            // Check if we actually got vehicle data (not a "not found" page)
            const make = data['make'];
            if (!make) {
                this.logger.log(`CarCheck: no vehicle data found for ${normalised}`);
                return null;
            }

            const model = data['model'];
            const colour = data['colour'] || data['color'];
            const yearStr = data['year of manufacture'];
            const gearbox = data['gearbox'];
            const fuelType = data['fuel type'] || data['fuel'];

            // Engine capacity: "1.200 cc" or "1998 cc" → parse to cc integer
            const engineRaw = data['engine capacity'] || data['engine size'];
            let engineSizeCc: number | undefined;
            if (engineRaw) {
                const cleaned = engineRaw.replace(/[^\d.]/g, '');
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) {
                    // If value looks like litres (e.g. 1.200), multiply by 1000
                    // If already in cc (e.g. 1998), keep as-is
                    engineSizeCc = parsed < 100 ? Math.round(parsed * 1000) : Math.round(parsed);
                }
            }

            // CO2: "133 g/km" → parse to integer
            const co2Raw = data['co2 emission'] || data['co2 emissions'] || data['co2'];
            let co2: number | undefined;
            if (co2Raw) {
                const co2Parsed = parseInt(co2Raw.replace(/[^\d]/g, ''), 10);
                if (!isNaN(co2Parsed)) co2 = co2Parsed;
            }

            const result: DvlaLookupResult = {
                vrm: normalised,
                make: make?.toUpperCase(),
                model: model?.toUpperCase(),
                colour: colour,
                year: yearStr ? parseInt(yearStr, 10) : undefined,
                engineSize: engineSizeCc,
                co2Emissions: co2,
                fuelType: fuelType ? (CC_FUEL_MAP[fuelType.toLowerCase()] ?? fuelType.toUpperCase()) : undefined,
                transmission: gearbox ? (CC_GEARBOX_MAP[gearbox.toLowerCase()] ?? gearbox.toUpperCase()) : undefined,
                dataSource: 'CARCHECK',
            };

            this.logger.log(`CarCheck: found ${result.make} ${result.model} (${result.year}) for VRM ${normalised}`);
            return result;
        } catch (err: any) {
            this.logger.error(`CarCheck fallback error: ${err?.message}`);
            return null;
        }
    }
}
