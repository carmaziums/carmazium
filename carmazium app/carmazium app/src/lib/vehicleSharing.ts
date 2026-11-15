export interface ShareableVehicle {
    id: string
    title?: string | null
    slug?: string | null
    type?: string | null
    status?: string | null
    auction?: { id: string } | null
}

/** Never share the current location: it can contain private query parameters. */
export function vehicleShareUrl(vehicle: ShareableVehicle, auctionId?: string | null): string {
    const auction = auctionId || (vehicle.type === 'AUCTION' ? vehicle.auction?.id : undefined)
    if (auction) return `https://www.carmazium.com/auctions/live/${encodeURIComponent(auction)}`
    const identifier = vehicle.slug || vehicle.id
    if (!identifier) throw new Error('This vehicle does not have a shareable link yet.')
    const route = vehicle.type === 'AUCTION' ? 'vehicle' : 'buy-cars'
    return `https://www.carmazium.com/${route}/${encodeURIComponent(identifier)}`
}

export function nativeVehicleSharePayload(vehicle: ShareableVehicle, platform: string, auctionId?: string | null) {
    const url = vehicleShareUrl(vehicle, auctionId)
    const title = vehicle.title?.trim() || 'Vehicle'
    const message = `${title} on CarMazium`
    return platform === 'ios' ? { title, message, url } : { title, message: `${message}\n${url}` }
}
