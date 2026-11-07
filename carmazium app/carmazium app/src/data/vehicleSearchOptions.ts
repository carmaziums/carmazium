import { CAR_MAKES, getModelsForMake, getVariantsForModel } from './carData';

export interface VehicleSearchOption { make: string; model: string | null; variant: string | null; vehicleType: string | null }
const key = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function mergeSearchOptions(...groups: string[][]): string[] {
  const values = new Map<string, string>();
  for (const group of groups) for (const value of group) {
    if (value?.trim() && !values.has(key(value))) values.set(key(value), value.trim());
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b, 'en-GB'));
}
export function searchMakes(stock: VehicleSearchOption[], vehicleType = '') {
  return mergeSearchOptions(CAR_MAKES, stock.filter(r => !vehicleType || r.vehicleType === vehicleType).map(r => r.make));
}
export function searchModels(stock: VehicleSearchOption[], make: string, vehicleType = '') {
  return mergeSearchOptions(getModelsForMake(CAR_MAKES.find(m => key(m) === key(make)) || make), stock.filter(r => key(r.make) === key(make) && (!vehicleType || r.vehicleType === vehicleType)).map(r => r.model || ''));
}
export function searchVariants(stock: VehicleSearchOption[], make: string, model: string, vehicleType = '') {
  return mergeSearchOptions(getVariantsForModel(make, model), stock.filter(r => key(r.make) === key(make) && key(r.model || '') === key(model) && (!vehicleType || r.vehicleType === vehicleType)).map(r => r.variant || ''));
}
