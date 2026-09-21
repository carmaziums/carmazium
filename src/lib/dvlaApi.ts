import { apiClient } from './apiClient';

// DVLA API types
export type EuroStandardValue = 'EURO_4' | 'EURO_5' | 'EURO_6' | 'EURO_6D';
export type BodyTypeValue = 'SEDAN' | 'SUV' | 'HATCHBACK' | 'COUPE' | 'CONVERTIBLE' | 'ESTATE' | 'CROSSOVER' | 'SPORTS_CAR' | 'MINIVAN' | 'PICKUP_TRUCK' | 'STATION_WAGON' | 'MPV' | 'VAN';

export interface DvlaLookupResult {
    make?: string;
    model?: string;
    colour?: string;
    primaryColour?: string;
    year?: number;
    engineSize?: number;
    fuelType?: string;
    transmission?: string;
    variant?: string;
    bodyType?: BodyTypeValue;
    driveType?: 'FWD' | 'RWD' | 'AWD' | '4WD';
    doors?: number;
    seats?: number;
    bhp?: number;
    engineDescription?: string;
    specEnrichment?: {
        confidence: 'LOW' | 'MEDIUM' | 'HIGH';
        matchBasis: 'EXACT_REGISTRATION' | 'PROFILE_CONSENSUS' | 'NONE';
        evidenceCount: number;
        source: 'AI_LIVE_WEB';
    };
    euroStandard?: string;
    co2Emissions?: number;
    dateOfLastV5CIssued?: string;
    motStatus?: string;
    taxStatus?: string;
    motExpiryDate?: string;
    taxDueDate?: string;
    markedForExport?: boolean;
    monthOfFirstRegistration?: string;
    wheelplan?: string;
    typeApproval?: string;
    motHistory?: MotTestResult[];
}

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

export async function dvlaLookup(vrm: string): Promise<DvlaLookupResult> {
    return apiClient<DvlaLookupResult>('/dvla/lookup', {
        method: 'POST',
        body: JSON.stringify({ vrm }),
    });
}
