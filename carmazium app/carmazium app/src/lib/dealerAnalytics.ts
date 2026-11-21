export interface AnalyticsData {
    kpis: {
        totalRevenue: number; totalRevenueTrend: number
        totalUnitsSold: number; totalUnitsSoldTrend: number
        avgDaysToSell: number; avgDaysToSellTrend: number
        offerConversionRate: number; offerConversionRateTrend: number
        leadConversionRate: number; leadConversionRateTrend: number
        avgViewsPerListing: number; avgViewsPerListingTrend: number
        avgSoldPrice: number
        stockValue: number
        marginVsListed: number
    }
    revenueTrend: Array<{ month: string; revenue: number; unitsSold: number }>
    leadFunnel: { NEW: number; CONTACTED: number; QUALIFIED: number; NEGOTIATING: number; WON: number; LOST: number }
    offerBreakdown: {
        PENDING: number; ACCEPTED: number; REJECTED: number; COUNTERED: number; WITHDRAWN: number
        avgAcceptedAmount: number; avgTimeToRespond: number
    }
    inventoryHealth: {
        DRAFT: number; ACTIVE: number; OFFER_ACCEPTED: number; SOLD: number; WITHDRAWN: number
        avgAge: number; staleCount: number
        agingBuckets: { '0-7d': number; '8-30d': number; '31-60d': number; '60d+': number }
    }
    topVehicles: Array<{
        id: string; title: string; image: string | null; views: number
        offerCount: number; price: number; status: string; daysListed: number
    }>
    topSellingModels: Array<{ make: string; model: string; units: number; revenue: number; avgPrice: number }>
    fastMovers: Array<{ make: string; model: string; units: number; avgDays: number }>
    slowMovers: Array<{ make: string; model: string; count: number; avgDays: number }>
    leadSourceBreakdown: Array<{ source: string; count: number }>
    salespersonPerformance: Array<{ name: string; total: number; won: number; active: number; conversionRate: number }>
    salesByType: { AUCTION: { units: number; revenue: number }; CLASSIFIED: { units: number; revenue: number } }
    customersByArea: Array<{ postcode: string; count: number; revenue: number }>
}

/** A valid report can have no sales while still containing inventory and leads. */
export function readDealerAnalytics(response: {data?: AnalyticsData}): AnalyticsData {
    const a=response?.data;
    if (!a?.kpis || !a.inventoryHealth || !a.leadFunnel || !a.offerBreakdown || !Array.isArray(a.revenueTrend) || !Array.isArray(a.topVehicles)) throw Error('Incomplete analytics response');
    return a;
}
