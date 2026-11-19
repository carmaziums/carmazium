import type { Listing } from './listingApi'

export type ServiceVehicle = Pick<Listing, 'id' | 'title' | 'status' | 'type' | 'vrm' | 'make' | 'model' | 'year' | 'location'>

export function vehicleServicePath(service: 'delivery' | 'inspection', listing: ServiceVehicle) {
    const params = new URLSearchParams({ listingId: listing.id, vehicleTitle: listing.title })
    if (listing.vrm) params.set('registration', listing.vrm)
    if (listing.make) params.set('make', listing.make)
    if (listing.model) params.set('model', listing.model)
    if (listing.year) params.set('year', String(listing.year))
    if (listing.location) params.set('pickup', listing.location)
    return `/services/${service}/new?${params.toString()}`
}
