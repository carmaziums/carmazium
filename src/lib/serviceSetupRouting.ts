export type JobService = 'DELIVERY' | 'INSPECTION'

/** Navigate only to the capability returned for the service the user selected. */
export function validatedServiceCapability(response: unknown, requested: JobService): { id: string; serviceType: JobService } {
    const envelope = response as { data?: unknown } | null
    const capability = (envelope?.data ?? response) as { id?: unknown; serviceType?: unknown } | null
    if (typeof capability?.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(capability.id) || capability.serviceType !== requested) {
        throw new Error('Service setup could not be verified. Refresh TradeXchange before trying again.')
    }
    return { id: capability.id, serviceType: requested }
}
