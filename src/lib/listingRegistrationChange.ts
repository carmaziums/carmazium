import { normalizeVehicleRegistration } from './sellerVehicleSpecs'

/** A lookup for a different registration must not inherit another car's facts. */
export function registrationLookupReset(previousVrm: string, nextVrm: string, selectedBodyType = '') {
    if (normalizeVehicleRegistration(previousVrm) === normalizeVehicleRegistration(nextVrm)) return {}
    return {
        make: '', model: '', variant: '', year: '', vin: '',
        transmission: '', bodyType: selectedBodyType === 'CAMPERVAN' ? 'CAMPERVAN' as const : '' as const, fuelType: '', engineSize: '',
        color: '', primaryColour: '', co2Emissions: '',
        motStatus: '', motExpiryDate: '', taxStatus: '', taxDueDate: '',
        dateOfLastV5CIssued: '', firstUsedDate: '', monthOfFirstRegistration: '',
        wheelplan: '', typeApproval: '', markedForExport: null,
        ulezCompliant: null, euroStandard: '' as const,
        motHistory: [], officialVehicleData: undefined,
    }
}
