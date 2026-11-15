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

export function vehicleShareLinks(title: string, url: string) {
    const text = `${title || 'Vehicle'} on CarMazium\n${url}`
    return {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        email: `mailto:?subject=${encodeURIComponent(`${title || 'Vehicle'} on CarMazium`)}&body=${encodeURIComponent(text)}`,
    }
}

export function vehicleShareNotice(vehicle: ShareableVehicle, auctionId?: string | null) {
    if (vehicle.status && ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'].includes(vehicle.status)) {
        return 'This listing is not public. Sharing its link does not publish it or give anyone access.'
    }
    if (auctionId || vehicle.type === 'AUCTION') return 'Dealer auctions require a verified dealer account to view and bid. Sharing does not change who can access the auction.'
    if (vehicle.status && ['SOLD', 'OFFER_ACCEPTED', 'EXPIRED', 'CANCELLED'].includes(vehicle.status)) return 'This vehicle may no longer be available. The shared page shows its current status.'
    return 'Choose an app, or copy the link to share anywhere. You decide who receives it.'
}
