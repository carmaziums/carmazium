import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    // ── Bonus fields from PulseCars fallback (DVLA doesn't supply these) ──────
    model?: string;
    mileage?: number;
    transmission?: string;    // MANUAL | AUTOMATIC | SEMI_AUTOMATIC
    bodyType?: string;        // mapped to our BodyType enum string
    doors?: number;
    dataSource?: 'DVLA' | 'PULSECARS';
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

// ─── PulseCars field mappings (PulseCars values → our enums) ──────────────────

const PC_FUEL_MAP: Record<string, string> = {
    'Petrol': 'PETROL',
    'Diesel': 'DIESEL',
    'Electric': 'ELECTRIC',
    'Hybrid': 'HYBRID',
    'Plug-in Hybrid': 'PLUGIN_HYBRID',
    'Plugin Hybrid': 'PLUGIN_HYBRID',
    'PETROL': 'PETROL',
    'DIESEL': 'DIESEL',
    'ELECTRIC': 'ELECTRIC',
    'HYBRID': 'HYBRID',
};

const PC_TRANSMISSION_MAP: Record<string, string> = {
    'Manual': 'MANUAL',
    'Automatic': 'AUTOMATIC',
    'Semi-Automatic': 'SEMI_AUTOMATIC',
    'Semi Automatic': 'SEMI_AUTOMATIC',
    'MANUAL': 'MANUAL',
    'AUTOMATIC': 'AUTOMATIC',
};

const PC_BODY_MAP: Record<string, string> = {
    'Saloon': 'SEDAN',
    'Sedan': 'SEDAN',
    'Hatchback': 'HATCHBACK',
    'SUV': 'SUV',
    'Estate': 'ESTATE',
    'Coupe': 'COUPE',
    'Convertible': 'CONVERTIBLE',
    'MPV': 'MPV',
    'Van': 'VAN',
    'Pick-up': 'PICKUP_TRUCK',
    'Pickup': 'PICKUP_TRUCK',
    'Crossover': 'CROSSOVER',
    'Sports': 'SPORTS_CAR',
    'Station Wagon': 'STATION_WAGON',
};

// ─── Endpoints ────────────────────────────────────────────────────────────────

const DVLA_PROD_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

/** PulseCars Supabase — owned by the same user; public anon key is intentional */
const PC_SUPABASE_URL = 'https://thkwimltjygbbtavxiua.supabase.co';
const PC_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoa3dpbWx0anlnYmJ0YXZ4aXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTgwNTAsImV4cCI6MjA3NjE3NDA1MH0.' +
    'gskxdLhiPaIJEZeafdZUgdz0on69MPBvr983w9dPLyg';

@Injectable()
export class DvlaService {
    private readonly logger = new Logger(DvlaService.name);
    private readonly apiKey: string | undefined;
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('DVLA_API_KEY');
        // DVLA_API_URL lets you point to the UAT endpoint for testing.
        // Defaults to the production URL when not set.
        this.baseUrl = this.configService.get<string>('DVLA_API_URL') ?? DVLA_PROD_URL;

        if (!this.apiKey) {
            this.logger.warn('DVLA_API_KEY is not set — will use PulseCars fallback for VRM lookup');
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
                    this.logger.warn(`DVLA: vehicle ${normalised} not found — trying PulseCars fallback`);
                } else {
                    this.logger.warn(`DVLA error for ${normalised}: ${err?.message} — trying PulseCars fallback`);
                }
                // fall through to PulseCars
            }
        }

        // 2. PulseCars Supabase fallback (user owns this site)
        const pcResult = await this.pulsecarsLookup(normalised, vrm.trim().toUpperCase());
        if (pcResult) {
            return pcResult;
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

    // ─── PulseCars Supabase fallback ──────────────────────────────────────────

    private async pulsecarsLookup(normalised: string, original?: string): Promise<DvlaLookupResult | null> {
        try {
            this.logger.log(`PulseCars fallback lookup for VRM: ${normalised}`);

            const fields = 'make,model,year,mileage,fuel_type,transmission,engine_size,color,doors,body_type,registration';

            // Build an OR filter to match both "P90PNT" and "P90 PNT" (however it was stored)
            const forms = [normalised];
            if (original && original !== normalised) forms.push(original);
            const orFilter = `(${forms.map(f => `registration.ilike.${f}`).join(',')})`;

            const url =
                `${PC_SUPABASE_URL}/rest/v1/cars` +
                `?or=${encodeURIComponent(orFilter)}` +
                `&select=${encodeURIComponent(fields)}` +
                `&limit=1`;

            const response = await fetch(url, {
                headers: {
                    apikey: PC_ANON_KEY,
                    Authorization: `Bearer ${PC_ANON_KEY}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                this.logger.warn(`PulseCars API returned ${response.status} for ${normalised}`);
                return null;
            }

            const rows: any[] = await response.json();
            if (!Array.isArray(rows) || rows.length === 0) {
                this.logger.log(`PulseCars: no record for VRM ${normalised}`);
                return null;
            }

            const car = rows[0];
            this.logger.log(`PulseCars: found ${car.make} ${car.model} for VRM ${normalised}`);

            // engine_size is stored in litres (e.g. 2.0); convert to cc for consistency
            const engineSizeLitres = car.engine_size ? parseFloat(car.engine_size) : NaN;
            const engineSizeCc = !isNaN(engineSizeLitres) ? Math.round(engineSizeLitres * 1000) : undefined;

            return {
                vrm: car.registration ?? normalised,
                make: car.make ?? undefined,
                model: car.model ?? undefined,
                colour: car.color ?? undefined,
                year: car.year ? Number(car.year) : undefined,
                mileage: car.mileage ? Number(car.mileage) : undefined,
                engineSize: engineSizeCc,
                fuelType: car.fuel_type
                    ? (PC_FUEL_MAP[car.fuel_type] ?? car.fuel_type.toUpperCase())
                    : undefined,
                transmission: car.transmission
                    ? (PC_TRANSMISSION_MAP[car.transmission] ?? car.transmission.toUpperCase())
                    : undefined,
                bodyType: car.body_type
                    ? (PC_BODY_MAP[car.body_type] ?? car.body_type.toUpperCase())
                    : undefined,
                doors: car.doors ? Number(car.doors) : undefined,
                dataSource: 'PULSECARS',
            };
        } catch (err: any) {
            this.logger.error(`PulseCars fallback error: ${err?.message}`);
            return null;
        }
    }
}
