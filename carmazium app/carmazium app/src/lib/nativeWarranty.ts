export type WarrantyOrder = {
  id: string; status: string; statusLabel: string; totalPence: number;
  price: { lines: { code: string; label: string; amountPence: number }[] };
  vehicle: Record<string, string | number | boolean>; expiresAt: string;
  warrantyReference?: string; coverStart?: string; coverEnd?: string;
};
export const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
export type WarrantyField = { key: string; label: string; options?: [string, string][]; optional?: boolean; numeric?: boolean; date?: boolean };
export const vehicleFields: WarrantyField[] = [
  { key: 'vrm', label: 'Vehicle registration' }, { key: 'make', label: 'Make' }, { key: 'model', label: 'Model' },
  { key: 'vehicleCategory', label: 'Vehicle category', options: [['CAR', 'Car'], ['SUV', 'SUV']] },
  { key: 'mileage', label: 'Current mileage (miles)', numeric: true }, { key: 'engineCc', label: 'Engine size (cc; 0 for electric)', numeric: true },
  { key: 'fuelType', label: 'Fuel', options: [['PETROL', 'Petrol'], ['DIESEL', 'Diesel'], ['HYBRID', 'Hybrid'], ['ELECTRIC', 'Electric'], ['OTHER', 'Other']] },
  { key: 'firstRegistrationDate', label: 'First registration date', date: true }, { key: 'manufactureDate', label: 'Manufacture date', optional: true, date: true },
  { key: 'retailValue', label: 'Purchase / retail value (£)', numeric: true },
  { key: 'origin', label: 'Origin', options: [['UK', 'UK'], ['EU', 'European import'], ['JAPAN', 'Japanese import'], ['OTHER', 'Other import']] },
  { key: 'serviceHistory', label: 'Service history', options: [['FULL', 'Full'], ['PART', 'Part'], ['LAST_SERVICE_ONLY', 'Last service only'], ['UNKNOWN', 'Unknown']] },
  { key: 'lastServiceDate', label: 'Last service date', date: true, optional: true }, { key: 'lastServiceMileage', label: 'Mileage at last service', numeric: true, optional: true },
  { key: 'purchaseDate', label: 'Purchase / expected purchase date', date: true }, { key: 'requestedStartDate', label: 'Requested warranty start date', date: true },
  { key: 'knownFaults', label: 'Known faults or warning lights', options: [['NONE', 'No known faults'], ['KNOWN', 'Yes, describe below']] },
];
export const customerFields: WarrantyField[] = [
  { key: 'title', label: 'Title', options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Mx', 'Dr', 'Other'].map(v => [v, v]) },
  { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' }, { key: 'email', label: 'Email address' },
  { key: 'phone', label: 'Phone number' }, { key: 'addressLine1', label: 'Residential address line 1' }, { key: 'addressLine2', label: 'Address line 2', optional: true },
  { key: 'town', label: 'Town / city' }, { key: 'county', label: 'County', optional: true }, { key: 'postcode', label: 'Postcode' },
];
export function warrantyPayload(values: Record<string, string>, extras: string[], confirmed: boolean, consent: boolean) {
  for (const field of [...vehicleFields, ...customerFields]) {
    const value = values[field.key]?.trim();
    if (!field.optional && !value) throw Error(`Complete ${field.label}.`);
    if (value && field.numeric && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw Error(`Check ${field.label}.`);
    if (value && field.date && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime()) || new Date(value).toISOString().slice(0, 10) !== value)) throw Error(`Enter ${field.label} as YYYY-MM-DD.`);
    if (value && field.options && !field.options.some(([key]) => key === value)) throw Error(`Select ${field.label}.`);
  }
  if (!confirmed || !consent) throw Error('Confirm the vehicle details and agree to the warranty order and privacy notices.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw Error('Enter a valid email address.');
  if (values.knownFaults === 'KNOWN' && (values.faultDetails?.trim().length || 0) < 5) throw Error('Describe the known faults.');
  const customer = Object.fromEntries(customerFields.map(f => [f.key, (values[f.key] || '').trim()]));
  const vehicle = {
    vrm: values.vrm.replace(/\s/g, '').toUpperCase(), make: values.make.trim(), model: values.model.trim(), mileage: Number(values.mileage), engineCc: Number(values.engineCc), fuelType: values.fuelType,
    firstRegistrationDate: values.firstRegistrationDate, ...(values.manufactureDate ? { manufactureDate: values.manufactureDate } : {}), retailValuePence: Math.round(Number(values.retailValue) * 100), origin: values.origin, serviceHistory: values.serviceHistory,
    ...(values.lastServiceDate ? { lastServiceDate: values.lastServiceDate } : {}), ...(values.lastServiceMileage ? { lastServiceMileage: Number(values.lastServiceMileage) } : {}), purchaseDate: values.purchaseDate, requestedStartDate: values.requestedStartDate, knownFaults: values.knownFaults, faultDetails: values.faultDetails || '', detailsConfirmed: confirmed,
  };
  return { customer, vehicle, selection: { vehicleCategory: values.vehicleCategory, months: 12, repairLimit: Number(values.repairLimit), labourRate: Number(values.labourRate), extras }, consent };
}
