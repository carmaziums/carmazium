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
    motExpiryDate?: string;
    taxStatus?: string;
    taxDueDate?: string;
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
    model?: string;
    colour?: string;
    primaryColour?: string;
    firstUsedDate?: string;
    year?: number;
    engineSize?: number;      // cc
    co2Emissions?: number;    // g/km
    fuelType?: string;        // mapped to our FuelType enum string
    euroStandard?: string;    // mapped to our EuroStandard enum string
    motStatus?: string;       // e.g. "Valid", "Not valid"
    motExpiryDate?: string;   // ISO date string
    taxStatus?: string;       // e.g. "Taxed", "SORN"
    taxDueDate?: string;      // ISO date string
    wheelplan?: string;       // e.g. "2 AXLE RIGID BODY"
    typeApproval?: string;    // e.g. "M1"
    revenueWeight?: number;   // kg
    markedForExport?: boolean;
    monthOfFirstRegistration?: string; // e.g. "2015-03"
    dateOfLastV5CIssued?: string;
    realDrivingEmissions?: string;
    transmission?: string;
    dataSource: 'DVLA';
    motHistory?: MotTestResult[];
}

// ─── MOT History API Response ──────────────────────────────────────────────────

export interface MotTestResult {
    completedDate: string;
    testResult: 'PASSED' | 'FAILED';
    expiryDate?: string;
    odometerValue?: string;
    odometerUnit?: string;
    motTestNumber: string;
    defects?: MotTestDefect[];
}

export interface MotTestDefect {
    text: string;
    type: 'ADVISORY' | 'MINOR' | 'MAJOR' | 'DANGEROUS';
    dangerous: boolean;
}

// ─── Fuel type mapping (DVLA values → our enum) ────────────────────────────────

const DVLA_FUEL_MAP: Record<string, string> = {
    PETROL: 'PETROL',
    DIESEL: 'DIESEL',
    'ELECTRIC': 'ELECTRIC',
    'ELECTRICITY': 'ELECTRIC',
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
    'EURO 6 DT': 'EURO_6D',
    'EURO 6 D-TEMP': 'EURO_6D',
    'EURO 6 AD': 'EURO_6D',
    'EURO 6 D': 'EURO_6D',
    'EURO 6D-TEMP': 'EURO_6D',
    'EURO 6D TEMP': 'EURO_6D',
};

// ─── Endpoint ─────────────────────────────────────────────────────────────────

const DVLA_PROD_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

@Injectable()
export class DvlaService {
    private readonly logger = new Logger(DvlaService.name);
    private readonly apiKey: string | undefined;
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('DVLA_API_KEY');
        this.baseUrl = this.configService.get<string>('DVLA_API_URL') ?? DVLA_PROD_URL;

        if (!this.apiKey) {
            this.logger.warn('DVLA_API_KEY is not set — VRM lookups will fail');
        }
        this.logger.log(`DVLA endpoint: ${this.baseUrl}`);
    }

    // ─── Public entry point ───────────────────────────────────────────────────

    async lookupVrm(vrm: string): Promise<DvlaLookupResult> {
        const normalised = vrm.replace(/\s+/g, '').toUpperCase();

        if (!/^[A-Z0-9]{2,7}$/.test(normalised)) {
            throw new BadRequestException(`Invalid UK registration number: "${vrm}"`);
        }

        if (!this.apiKey) {
            throw new ServiceUnavailableException(
                'DVLA API key is not configured. Please contact the administrator.',
            );
        }

        const [dvlaResult, motResult] = await Promise.allSettled([
            this.dvlaRequest(normalised),
            this.motApiRequest(normalised)
        ]);

        if (dvlaResult.status === 'rejected') {
            throw dvlaResult.reason;
        }

        const combined = dvlaResult.value;
        if (motResult.status === 'fulfilled' && motResult.value) {
            combined.motHistory = motResult.value.motTests;
            if (motResult.value.model) combined.model = motResult.value.model;
            if (motResult.value.primaryColour) combined.primaryColour = motResult.value.primaryColour;
            if (motResult.value.firstUsedDate) combined.firstUsedDate = motResult.value.firstUsedDate;
        }

        return combined;
    }

    // ─── DVLA REST request ────────────────────────────────────────────────────

    private async dvlaRequest(normalised: string): Promise<DvlaLookupResult> {
        this.logger.log(`DVLA lookup for VRM: ${normalised}`);

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey!,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ registrationNumber: normalised }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new BadRequestException(
                    `Vehicle not found for registration: ${normalised}. Please check the number and try again.`,
                );
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
            motExpiryDate: data.motExpiryDate,
            taxStatus: data.taxStatus,
            taxDueDate: data.taxDueDate,
            wheelplan: data.wheelplan,
            typeApproval: data.typeApproval,
            revenueWeight: data.revenueWeight,
            markedForExport: data.markedForExport,
            monthOfFirstRegistration: data.monthOfFirstRegistration,
            dateOfLastV5CIssued: data.dateOfLastV5CIssued,
            realDrivingEmissions: data.realDrivingEmissions,
            transmission: (data as any).transmission,
            dataSource: 'DVLA',
        };
    }

    // ─── MOT History API REST request ─────────────────────────────────────────

    private async motApiRequest(normalised: string): Promise<{ motTests: MotTestResult[], model?: string, primaryColour?: string, firstUsedDate?: string } | null> {
        const motApiKey = this.configService.get<string>('MOT_API_KEY');
        if (!motApiKey) {
            this.logger.warn('MOT_API_KEY is not set — MOT History lookup will be skipped');
            return null;
        }

        const url = `https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${normalised}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-api-key': motApiKey,
                    'Accept': 'application/json+v6',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    this.logger.log(`No MOT history found for ${normalised}`);
                    return { motTests: [] };
                }
                const text = await response.text().catch(() => '');
                this.logger.error(`MOT API error ${response.status}: ${text}`);
                return null;
            }

            const data = await response.json();
            
            // The API returns an array of vehicles (usually just one) with motTests
            if (Array.isArray(data) && data.length > 0) {
                const vehicle = data[0];
                return {
                    motTests: vehicle.motTests || [],
                    model: vehicle.model,
                    primaryColour: vehicle.primaryColour,
                    firstUsedDate: vehicle.firstUsedDate
                };
            }
            
            return { motTests: [] };
        } catch (error) {
            this.logger.error(`MOT API request failed:`, error);
            return null;
        }
    }
}
