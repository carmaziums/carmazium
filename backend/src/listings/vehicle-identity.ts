import { BadRequestException } from '@nestjs/common';
import type { DvlaLookupResult } from '../dvla/dvla.service';
import type { VehicleValuationResult } from './vehicle-valuation';
import { canonicalValuationMake, canonicalValuationModel } from './vehicle-valuation-identity';

export type IdentityVerificationStatus = 'MODEL_VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

export interface ValuationIdentityVerification {
    status: IdentityVerificationStatus;
    registrationChecked: boolean;
    makeVerified: boolean;
    modelVerified: boolean;
    derivativeVerified: boolean;
    message: string;
}

// DVLA establishes make and manufacture year. The separate MOT result can
// establish model, but neither service reliably establishes the derivative.
// Do not label an unverified performance trim as an exact vehicle match.
const normalized = (value: string | undefined | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

function normalizedMake(value: string | undefined | null): string {
    return canonicalValuationMake(value ?? '');
}

function normalizedModel(value: string | undefined | null, make?: string): string {
    return canonicalValuationModel(value ?? '', make ?? '');
}

// A known data-source formatting difference: some registration providers
// append a single model-generation digit (e.g. SPORTAGE3). Accept the generic
// model family only provisionally; never equate two *different* generations.
function stripTrailingGenerationDigit(model: string): string {
    const match = model.match(/^([A-Z]{5,})[0-9]$/);
    return match ? match[1] : model;
}

export function verifyValuationVehicleIdentity(
    request: { registration?: string; make: string; model: string; year: number; variant?: string },
    lookup: DvlaLookupResult | null,
): ValuationIdentityVerification {
    if (!request.registration?.trim()) {
        return {
            status: 'UNVERIFIED',
            registrationChecked: false,
            makeVerified: false,
            modelVerified: false,
            derivativeVerified: false,
            message: 'Vehicle registration was not checked. Confirm the exact vehicle before relying on this estimate.',
        };
    }

    if (!lookup) {
        // The caller must not turn a failed authoritative lookup into a price.
        throw new BadRequestException('Registration verification is unavailable. Please retry or request a manual valuation.');
    }

    const requestedVrm = normalized(request.registration);
    if (!lookup.vrm || normalized(lookup.vrm) !== requestedVrm) {
        throw new BadRequestException('Registration lookup returned a different vehicle. Please check the registration.');
    }
    if (!lookup.make || normalizedMake(lookup.make) !== normalizedMake(request.make)) {
        throw new BadRequestException(
            'Vehicle make does not match the registration. Check the vehicle details before valuing.',
        );
    }
    if (lookup.year && Math.abs(lookup.year - request.year) > 1) {
        throw new BadRequestException(
            'Vehicle year does not match the registration. Check manufacture/registration year before valuing.',
        );
    }

    const sourceModel = normalizedModel(lookup.model, lookup.make);
    const requestedModel = normalizedModel(request.model, request.make);
    const requestedWithVariant = request.variant?.trim()
        ? normalizedModel(`${request.model} ${request.variant}`, request.make)
        : requestedModel;
    const modelAndVariantVerified = Boolean(
        sourceModel && requestedWithVariant !== requestedModel && sourceModel === requestedWithVariant,
    );
    const generationFamilyOnly = Boolean(
        sourceModel
        && sourceModel !== requestedModel
        && (
            sourceModel === stripTrailingGenerationDigit(requestedModel)
            || requestedModel === stripTrailingGenerationDigit(sourceModel)
        ),
    );
    if (sourceModel && sourceModel !== requestedModel && !modelAndVariantVerified && !generationFamilyOnly) {
        // Never silently treat a performance derivative as the base model.
        throw new BadRequestException(
            'Vehicle model does not match registration records. Confirm the exact model and derivative before valuing.',
        );
    }

    const modelVerified = Boolean(
        sourceModel && (sourceModel === requestedModel || modelAndVariantVerified),
    );
    const derivativeVerified = !request.variant?.trim()
        || modelAndVariantVerified
        || Boolean(lookup.variant && normalized(lookup.variant) === normalized(request.variant));
    const yearVerified = lookup.year != null && lookup.year === request.year;
    const fullyVerified = modelVerified && derivativeVerified && yearVerified;
    return {
        status: fullyVerified ? 'MODEL_VERIFIED' : 'PARTIAL',
        registrationChecked: true,
        makeVerified: true,
        modelVerified,
        derivativeVerified: Boolean(request.variant?.trim() && derivativeVerified),
        message: fullyVerified
            ? 'Registration, make, model and manufacture year match available registration records. Optional specification may still need confirmation.'
            : 'Only part of the vehicle identity is independently confirmed. Check the exact model, derivative and year before relying on this estimate.',
    };
}

export function labelValuationIdentity(
    valuation: VehicleValuationResult,
    verification: ValuationIdentityVerification,
): VehicleValuationResult {
    const provisional = verification.status !== 'MODEL_VERIFIED';
    return {
        ...valuation,
        identityVerification: verification,
        ...(provisional
            ? {
                confidence: 'LOW' as const,
                confidenceScore: Math.min(valuation.confidenceScore, 0.49),
                explanation: `${valuation.explanation} ${verification.message}`,
            }
            : {}),
    };
}
