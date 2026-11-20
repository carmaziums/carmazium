/** Subcategories of the existing INSPECTION TradeXchange service. */
export const INSPECTION_SCOPES = ['VEHICLE', 'COSMETIC', 'BOTH'] as const;
export type InspectionScope = typeof INSPECTION_SCOPES[number];
export type ProviderInspectionScope = Exclude<InspectionScope, 'BOTH'>;

export function providerInspectionScopes(scopes?: string[] | null): ProviderInspectionScope[] {
    // An existing inspection capability is treated as vehicle-only for safety.
    const values = scopes ?? ['VEHICLE'];
    return (['VEHICLE', 'COSMETIC'] as const).filter(value => values.includes(value));
}

/** A combined job requires the same provider to offer BOTH inspection specialties. */
export function providerSupportsInspection(scopes: string[] | null | undefined, requested: string | null | undefined): boolean {
    const selected = providerInspectionScopes(scopes);
    const kind = requested || 'VEHICLE';
    if (kind === 'BOTH') return selected.includes('VEHICLE') && selected.includes('COSMETIC');
    return kind === 'VEHICLE' || kind === 'COSMETIC' ? selected.includes(kind) : false;
}

/** Values to match against service_jobs.inspectionScope in a provider's feed. */
export function eligibleInspectionJobScopes(scopes?: string[] | null): InspectionScope[] {
    const selected = providerInspectionScopes(scopes);
    return selected.length === 2 ? ['VEHICLE', 'COSMETIC', 'BOTH'] : selected;
}
