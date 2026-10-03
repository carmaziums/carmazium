/** Never resume a later step when the persisted subset omitted required answers. */
export interface ResumableNativeSellerDetails {
  vrm: string; make: string; model: string; year: string; mileage: string
  title: string; location: string; fuelType: string; transmission: string
  bodyType: string; vehicleType: 'CAR' | 'HGV' | 'MOTORCYCLE'
  condition: string; owners: string; writeOffCat: string
  stolenRecovered: boolean | null; outstandingFinance: boolean | null
  isLegalKeeper: boolean | null; notOwnerRelationship: string
  isDepartedSale: boolean; departedRelationship: string
  declAcknowledged: boolean; description: string
}
export function nativeDraftStepOneComplete(
  draft: ResumableNativeSellerDetails,
  validTransmission: (value: unknown) => string,
  validBody: (value: unknown, type: ResumableNativeSellerDetails['vehicleType']) => string,
): boolean {
  return /^[A-Z0-9]{2,8}$/.test(draft.vrm.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    && !!draft.make.trim() && !!draft.model.trim() && !!draft.year.trim()
    && !!draft.title.trim() && !!draft.location.trim() && !!draft.mileage.trim()
    && !!draft.fuelType.trim() && !!validTransmission(draft.transmission)
    && (draft.vehicleType === 'MOTORCYCLE' || !!validBody(draft.bodyType, draft.vehicleType))
    && !!draft.condition && !!draft.owners && !!draft.writeOffCat
    && draft.stolenRecovered !== null && draft.outstandingFinance !== null
    && draft.isLegalKeeper !== null
    && (draft.isLegalKeeper !== false || !!draft.notOwnerRelationship.trim())
    && (!draft.isDepartedSale || !!draft.departedRelationship.trim())
    && draft.declAcknowledged && !!draft.description.trim()
}
