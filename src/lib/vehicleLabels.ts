// src/lib/vehicleLabels.ts
export const BODY_TYPE_LABELS: Record<string, string> = {
    SEDAN: 'Sedan', SUV: 'SUV', HATCHBACK: 'Hatchback', COUPE: 'Coupé',
    CONVERTIBLE: 'Convertible', ESTATE: 'Estate', CROSSOVER: 'Crossover',
    SPORTS_CAR: 'Sports Car', MINIVAN: 'Minivan', PICKUP_TRUCK: 'Pickup',
    STATION_WAGON: 'Wagon', MPV: 'MPV', VAN: 'Van',
}

export const FUEL_TYPE_LABELS: Record<string, string> = {
    PETROL: 'Petrol', DIESEL: 'Diesel', ELECTRIC: 'Electric',
    HYBRID: 'Hybrid', PLUGIN_HYBRID: 'Plug-in', LPG: 'LPG',
    HYDROGEN_CELL: 'Hydrogen',
    BI_FUEL: 'Bi Fuel', NATURAL_GAS: 'Natural Gas',
    PETROL_HYBRID: 'Petrol Hybrid', DIESEL_HYBRID: 'Diesel Hybrid',
    PETROL_PLUGIN_HYBRID: 'Petrol Plug-in Hybrid', DIESEL_PLUGIN_HYBRID: 'Diesel Plug-in Hybrid',
    UNLISTED: 'Unlisted',
}
