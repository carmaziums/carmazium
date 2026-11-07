import { VEHICLE_FEATURES } from './search-feature-options';
/** Public search contract: AI output cannot invent API fields or enum members. */
const enums: Record<string, string[]> = {
    bodyType: ['SEDAN', 'HATCHBACK', 'SUV', 'COUPE', 'CONVERTIBLE', 'ESTATE', 'MPV', 'PICKUP_TRUCK', 'VAN', 'STATION_WAGON', 'SPORTS_CAR', 'CROSSOVER', 'MINIVAN'],
    fuelType: ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'PLUGIN_HYBRID', 'LPG', 'HYDROGEN_CELL', 'BI_FUEL', 'NATURAL_GAS', 'PETROL_HYBRID', 'DIESEL_HYBRID', 'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID', 'UNLISTED'],
    transmission: ['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC', 'CVT'],
    vehicleType: ['CAR', 'HGV', 'MOTORCYCLE'], sellerType: ['PRIVATE', 'DEALER'],
    driveType: ['FWD', 'RWD', 'AWD', '4WD'], euroStandard: ['EURO_4', 'EURO_5', 'EURO_6', 'EURO_6D'],
    conditions: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
    writeOffCategories: ['NONE', 'CAT_S', 'CAT_N', 'CAT_C', 'CAT_D', 'CAT_A', 'CAT_B'],
    serviceHistories: ['FULL_MAIN_DEALER', 'FULL_INDEPENDENT', 'PARTIAL', 'NONE'],
    sortBy: ['newest', 'price_asc', 'price_desc', 'mileage_asc', 'mileage_desc', 'year_asc', 'year_desc'],
};
const numeric = ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage', 'minDoors', 'minSeats', 'minEngine', 'maxEngine', 'maxCo2', 'minBhp', 'maxBhp', 'minCombinedMpg', 'maxZeroTo60Mph', 'maxOwners'];
const booleans = ['ulezCompliant', 'isImported', 'deliveryAvailable', 'motValid', 'taxedOnly'];
const textFields = ['make', 'model', 'variant', 'color', 'location', 'search'];
const multi: Record<string, string> = { fuelTypes: 'fuelType', transmissions: 'transmission', conditions: 'conditions', writeOffCategories: 'writeOffCategories', serviceHistories: 'serviceHistories' };
const alias: Record<string, string> = { maxEngineSize: 'maxEngine', minEngineSize: 'minEngine', colour: 'color' };
export const SEARCH_FILTER_GUIDANCE = `Valid filters (all values must be strings):
${Object.entries(enums).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n')}
${numeric.join(', ')}: non-negative numbers. Engine size is in cc, mileage in miles, price in GBP. Convert 1.6 litres to 1600 cc and 60k miles to 60000.
${booleans.join(', ')}: true or false. Exclude imports means isImported=false.
${textFields.join(', ')}: text. Location is a city or postcode area, not a distance radius.
fuelTypes, transmissions, conditions, writeOffCategories, serviceHistories: comma-separated lists of the corresponding valid enum values.
features: comma-separated exact labels from ${VEHICLE_FEATURES.join(", ")}.
exteriorGrades: comma-separated integers from 1 to 5.
Only extract the current query's requirements. Never invent a filter name. Never imply that you checked stock or that a car has verified history. If a requested criterion has no supported filter (such as insurance cost or a postcode radius), explicitly explain that limitation in text. Do not add a keyword search for a criterion already represented by a structured filter.`;

export function normalizeAiSearchFilters(input: unknown): Record<string, string> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const out: Record<string, string> = {};
    for (const [rawKey, raw] of Object.entries(input)) {
        const key = alias[rawKey] ?? rawKey;
        if (raw === null || raw === undefined || typeof raw === 'object') continue;
        let value = String(raw).trim();
        if (!value) continue;
        if (textFields.includes(key)) { if (value.length <= 150) out[key] = value; continue; }
        if (numeric.includes(key)) {
            if (!/^\d+(\.\d+)?$/.test(value)) continue;
            const n = Number(value);
            if (!Number.isFinite(n) || n > 100000000) continue;
            if (!['minPrice', 'maxPrice', 'minCombinedMpg', 'maxZeroTo60Mph'].includes(key) && !Number.isInteger(n)) continue;
            if (key === 'maxOwners' && (n < 1 || n > 5)) continue;
            if (['minYear', 'maxYear'].includes(key) && (n < 1886 || n > new Date().getFullYear() + 1)) continue;
            out[key] = String(n); continue;
        }
        if (booleans.includes(key)) {
            value = value.toLowerCase();
            if (['yes', 'true'].includes(value)) out[key] = 'true';
            if (['no', 'false'].includes(value)) out[key] = 'false';
            continue;
        }
        if (key === 'features') {
            const values = value.split(',').map(v => VEHICLE_FEATURES.find(feature => feature.toLowerCase() === v.trim().toLowerCase())).filter((v): v is string => !!v);
            if (values.length) out[key] = [...new Set(values)].join(',');
            continue;
        }
        if (key === 'exteriorGrades') {
            const values = value.split(',').map(v => v.trim()).filter(v => /^[1-5]$/.test(v));
            if (values.length) out[key] = [...new Set(values)].join(',');
            continue;
        }
        const enumKey = multi[key] ?? key;
        if (enums[enumKey]) {
            const values = (multi[key] ? value.split(',') : [value]).map(v => {
                const vnorm = v.trim().toUpperCase().replace(/[ -]+/g, '_');
                return enumKey === 'bodyType' && vnorm === 'PICKUP' ? 'PICKUP_TRUCK'
                    : enumKey === 'bodyType' && vnorm === 'SALOON' ? 'SEDAN'
                    : enumKey === 'sortBy' ? v.trim().toLowerCase() : vnorm;
            }).filter(v => enums[enumKey].includes(v));
            if (values.length) out[key] = [...new Set(values)].join(',');
        }
    }
    return out;
}
