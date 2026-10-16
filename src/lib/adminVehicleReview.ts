/**
 * Admin-only, evidence-aware review hints for an individual listing.
 * These are tasks for staff, NOT seller-facing validations or publication rules.
 * DVLA/DVSA does not supply service history, keys or guaranteed BHP/MPG/equipment.
 */
export interface AdminVehicleReviewItem {
  field: string;
  label: string;
  source: 'DVLA/DVSA' | 'Seller';
  explanation: string;
  currentValue: string;
  sellerField?: string;
  official?: boolean;
}

export function getAdminVehicleReviewItems(listing: any): AdminVehicleReviewItem[] {
  if (!listing || listing.deletedAt ||
    !['ACTIVE', 'PENDING_REVIEW'].includes(listing.status) ||
    !['CLASSIFIED', 'AUCTION'].includes(listing.type)) return [];

  const items: AdminVehicleReviewItem[] = [];
  const absent = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
  const add = (field: string, label: string, source: AdminVehicleReviewItem['source'],
    explanation: string, options: Pick<AdminVehicleReviewItem, 'sellerField' | 'official'> = {}) => {
    items.push({
      field, label, source, explanation, ...options,
      currentValue: 'Not recorded',
    });
  };

  if (absent(listing.model)) add('model', 'Model', 'DVLA/DVSA',
    'The DVLA vehicle enquiry does not guarantee the model. Try the official MOT record; if unavailable, ask the seller to confirm.', { official: true, sellerField: 'model' });
  if (absent(listing.transmission)) add('transmission', 'Gearbox / transmission', 'Seller',
    'Not guaranteed by the official vehicle enquiry. Ask the seller or correct it using verified evidence.', { sellerField: 'transmission' });
  if (absent(listing.location)) add('location', 'Collection location', 'Seller',
    'The seller should confirm the collection town or postcode.', { sellerField: 'location' });

  const motStatus = String(listing.motStatus ?? '').trim().toLowerCase();
  if (!motStatus) add('motStatus', 'MOT status', 'DVLA/DVSA',
    'A saved MOT status is absent. Recheck the official source; do not infer a pass.', { official: true });
  const validMot = motStatus === 'valid' || motStatus === 'mot valid';
  if (validMot && absent(listing.motExpiryDate)) {
    add('motExpiryDate', 'MOT expiry date', 'DVLA/DVSA',
      'MOT is recorded as valid, but the expiry date was not saved. Recheck the official source.', { official: true });
  }
  if (validMot && (!Array.isArray(listing.motHistory) || listing.motHistory.length === 0)) {
    add('motHistory', 'Saved MOT test history', 'DVLA/DVSA',
      'The listing has a valid MOT status but no stored DVSA test records. Retrieval may have failed or this may be an older listing. Recheck; do not invent test results.', { official: true });
  }
  if (listing.numberOfKeys == null) add('numberOfKeys', 'Number of keys', 'Seller',
    'DVLA/DVSA does not provide a key count. Ask the seller or enter the verified count.', { sellerField: 'numberOfKeys' });
  if (absent(listing.serviceHistory)) add('serviceHistory', 'Service history', 'Seller',
    'DVLA/DVSA does not provide the vehicle service book or invoices. Ask the seller.', { sellerField: 'serviceHistory' });

  // BHP, MPG, equipment and postcode coordinates are optional enrichments, not
  // DVLA/DVSA guarantees. Their absence must not inflate admin error counts.
  return items;
}
