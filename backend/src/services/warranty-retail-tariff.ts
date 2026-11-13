/**
 * Approved Pulse Cars retail tariff, VAT inclusive, in integer pence.
 * Used for immutable customer quote/checkout snapshots. This is the agreed retail
 * tariff, not a supplier quote or confirmation that warranty cover has been issued.
 */
export const WARRANTY_TARIFF_VERSION = 'pulse-retail-12m-2026-11-13';
export const WARRANTY_REPAIR_LIMITS = [1000, 2000] as const;
export const WARRANTY_LABOUR_RATES = [75, 100, 150, 200] as const;
export const WARRANTY_EXTRAS = {
    AIRBAGS: { label: 'Airbag protection', pricePence: 2000 },
    DRIVER_ASSISTANCE: { label: 'Driver assistance', pricePence: 2000 },
    EMISSIONS: { label: 'Emissions', pricePence: 2000 },
    MULTIMEDIA: { label: 'Multimedia', pricePence: 8000 },
} as const;

export interface WarrantyTariffSelection {
    vehicleCategory: 'CAR' | 'SUV';
    months: 12;
    repairLimit: 1000 | 2000;
    labourRate: 75 | 100 | 150 | 200;
    extras: Array<keyof typeof WARRANTY_EXTRAS>;
}

export function calculateWarrantyRetailPrice(input: WarrantyTariffSelection) {
    // Runtime checks are required even when the caller uses TypeScript types.
    if (!input || !['CAR', 'SUV'].includes(input.vehicleCategory)) throw new Error('Confirm car or SUV classification.');
    if (input.months !== 12) throw new Error('Only the 12-month tariff is configured.');
    if (!(WARRANTY_REPAIR_LIMITS as readonly number[]).includes(input.repairLimit)) throw new Error('Unsupported repair limit.');
    if (!(WARRANTY_LABOUR_RATES as readonly number[]).includes(input.labourRate)) throw new Error('Unsupported labour rate.');
    if (!Array.isArray(input.extras) || input.extras.some(key => !Object.prototype.hasOwnProperty.call(WARRANTY_EXTRAS, key))) throw new Error('Unsupported warranty addition.');
    if (new Set(input.extras).size !== input.extras.length) throw new Error('An addition may only be selected once.');

    const standardPence = input.vehicleCategory === 'SUV' ? 44500 : 36000;
    const basePence = standardPence - (input.repairLimit === 1000 ? 3000 : 0);
    const labourPercentage = { 75: 0, 100: 50, 150: 75, 200: 100 }[input.labourRate];
    // Labour always uses the original £360/£445 standard, never an upgraded total.
    const labourPence = standardPence * labourPercentage / 100;
    const lines = [
        { code: 'BASE', label: `12 months, £${input.repairLimit.toLocaleString('en-GB')} single repair limit, £75/hour labour`, amountPence: basePence },
        ...(labourPence ? [{ code: 'LABOUR', label: `£${input.labourRate}/hour labour`, amountPence: labourPence }] : []),
        ...Object.keys(WARRANTY_EXTRAS).filter(key => input.extras.includes(key as keyof typeof WARRANTY_EXTRAS)).map(key => ({
            code: key,
            label: WARRANTY_EXTRAS[key as keyof typeof WARRANTY_EXTRAS].label,
            amountPence: WARRANTY_EXTRAS[key as keyof typeof WARRANTY_EXTRAS].pricePence,
        })),
    ];
    return {
        tariffVersion: WARRANTY_TARIFF_VERSION,
        currency: 'GBP' as const,
        vatIncluded: true,
        lines,
        totalPence: lines.reduce((total, line) => total + line.amountPence, 0),
    };
}
