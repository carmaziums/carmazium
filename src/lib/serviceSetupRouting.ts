export type JobService = 'DELIVERY' | 'INSPECTION'

/** Navigate only to the capability returned for the service the user selected. */
export function serviceVerificationPath(response: unknown, requested: JobService): string {
    const envelope = response as { data?: unknown } | null
    const capability = (envelope?.data ?? response) as { id?: unknown; serviceType?: unknown } | null
    if (typeof capability?.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(capability.id) || capability.serviceType !== requested) {
        throw new Error('Your service setup could not be opened. Open My services to check your application before trying again.')
    }
    return `/dashboard/service/capabilities/${capability.id}/verification`
}
