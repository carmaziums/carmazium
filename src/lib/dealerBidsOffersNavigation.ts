/**
 * Choose the shared dealer Bids & offers tab destination without granting
 * staff access to a view their dealership role does not permit.
 *
 * VIEW_TRADE-only staff use live auction bids. MANAGE_OFFERS-only staff use
 * retail offers. Staff with both permissions see the bid view first and
 * can move between the two using BidsOffersSwitch.
 */
export function bidsOffersTabHref(
    canViewTrade: boolean,
    canManageOffers: boolean,
): "/dashboard/dealer/bids" | "/dashboard/dealer/my-offers" | null {
    if (canViewTrade) return "/dashboard/dealer/bids"
    if (canManageOffers) return "/dashboard/dealer/my-offers"
    return null
}
