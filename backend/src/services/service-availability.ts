import { ServiceUnavailableException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';

const ENV_BY_SERVICE: Record<ServiceType, string> = {
    [ServiceType.DELIVERY]: 'NEXT_PUBLIC_FEATURE_DELIVERY',
    [ServiceType.INSPECTION]: 'NEXT_PUBLIC_FEATURE_INSPECTION',
    [ServiceType.FINANCE]: 'NEXT_PUBLIC_FEATURE_FINANCE_SERVICES',
    [ServiceType.WARRANTY]: 'NEXT_PUBLIC_FEATURE_WARRANTY',
};

const LABEL_BY_SERVICE: Record<ServiceType, string> = {
    [ServiceType.DELIVERY]: 'Delivery & Recovery',
    [ServiceType.INSPECTION]: 'Vehicle Inspection',
    [ServiceType.FINANCE]: 'Vehicle Finance',
    [ServiceType.WARRANTY]: 'Warranty',
};

export function parseLiveServiceFlag(name: string, value?: string): boolean {
    const normalised = value?.trim().toLowerCase();

    if (!normalised) return true;
    if (normalised === 'true') return true;
    if (normalised === 'false') return false;

    throw new Error(
        `Invalid ${name} value "${value}". Use "true" to keep the service live or "false" for the emergency kill switch.`,
    );
}

export function validateServiceAvailabilityConfig(env: NodeJS.ProcessEnv = process.env) {
    for (const name of Object.values(ENV_BY_SERVICE)) {
        parseLiveServiceFlag(name, env[name]);
    }
}

export function serviceAcceptingNewRequests(
    serviceType: ServiceType,
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    const name = ENV_BY_SERVICE[serviceType];
    return parseLiveServiceFlag(name, env[name]);
}

export function assertServiceAcceptingNewRequests(serviceType: ServiceType) {
    if (serviceAcceptingNewRequests(serviceType)) return;

    throw new ServiceUnavailableException(
        `${LABEL_BY_SERVICE[serviceType]} is temporarily not accepting new requests. Existing jobs and enquiries are unaffected.`,
    );
}

export function serviceAvailabilitySnapshot(env: NodeJS.ProcessEnv = process.env) {
    return {
        DELIVERY: serviceAcceptingNewRequests(ServiceType.DELIVERY, env),
        INSPECTION: serviceAcceptingNewRequests(ServiceType.INSPECTION, env),
        FINANCE: serviceAcceptingNewRequests(ServiceType.FINANCE, env),
        WARRANTY: serviceAcceptingNewRequests(ServiceType.WARRANTY, env),
    };
}

validateServiceAvailabilityConfig();
