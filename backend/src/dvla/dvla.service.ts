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

const DVLA_PROD_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_UAT_URL = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

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
            this.logger.warn('DVLA_API_KEY is not set — VRM lookup will be unavailable');
        }
        this.logger.log(`DVLA endpoint: ${this.baseUrl}`);
    }

    async lookupVrm(vrm: string): Promise<DvlaLookupResult> {
        if (!this.apiKey) {
            throw new ServiceUnavailableException(
                'DVLA API key not configured. Add DVLA_API_KEY to backend/.env to enable VRM auto-fill.',
            );
        }

        const normalised = vrm.replace(/\s+/g, '').toUpperCase();

        if (!/^[A-Z0-9]{2,7}$/.test(normalised)) {
            throw new BadRequestException(`Invalid UK registration number: "${vrm}"`);
        }

        this.logger.log(`DVLA lookup for VRM: ${normalised}`);

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
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
        };
    }
}
