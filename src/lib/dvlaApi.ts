import { apiClient } from './apiClient';

// DVLA API types
export type EuroStandardValue = 'EURO_4' | 'EURO_5' | 'EURO_6' | 'EURO_6D';
export type BodyTypeValue = 'HATCHBACK' | 'SALOON' | 'ESTATE' | 'SUV' | 'COUPE' | 'CONVERTIBLE' | 'MPV' | 'SPORT' | 'VAN' | 'MINIBUS' | 'CAMPER' | 'PICKUP' | 'OTHER';

export interface DvlaLookupResult {
    make?: string;
    model?: string;
    colour?: string;
    primaryColour?: string;
    firstUsedDate?: string;
    year?: number;
    engineSize?: number;
    fuelType?: string;
    euroStandard?: string;
    co2Emissions?: number;
    revenueWeight?: number;
    dateOfLastV5CIssued?: string;
    realDrivingEmissions?: string;
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
