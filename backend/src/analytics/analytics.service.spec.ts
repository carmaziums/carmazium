import { AnalyticsService } from './analytics.service';

describe('AnalyticsService live valuation analytics', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns admin-safe real-time valuation aggregates and conversion attribution', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-21T20:00:00.000Z'));

        const prisma = {
            $queryRawUnsafe: jest
                .fn()
                .mockResolvedValueOnce([{
                    requests: '18',
                    unique_sessions: '13',
                    logged_in_users: '11',
                    logged_in_sessions: '11',
                    anonymous_sessions: '2',
                    auction_requests: '15',
                    retail_requests: '3',
                    valuation_attempts: '20',
                    figures_returned: '17',
                    confirmed_no_figures: '2',
                }])
                .mockResolvedValueOnce([
                    { hour: '18:00', requests: '4', sessions: '3' },
                    { hour: '19:00', requests: '2', sessions: '2' },
                ])
                .mockResolvedValueOnce([
                    { date: '2026-09-20', requests: '9', sessions: '7', valuation_attempts: '10', figures_returned: '8', confirmed_no_figures: '1' },
                    { date: '2026-09-21', requests: '18', sessions: '13', valuation_attempts: '20', figures_returned: '17', confirmed_no_figures: '2' },
                ])
                .mockResolvedValueOnce([
                    {
                        date: '2026-09-20',
                        valuation_journeys: '7',
                        started_journeys: '3',
                        converted_journeys: '2',
                        listing_count: '2',
                        retail_listings: '1',
                        auction_listings: '1',
                        retail_fee_paid: '1',
                        reached_review: '2',
                        retail_reached_review: '1',
                        auction_reached_review: '1',
                        approved_live: '1',
                        rejected: '0',
                    },
                    {
                        date: '2026-09-21',
                        valuation_journeys: '13',
                        started_journeys: '8',
                        converted_journeys: '5',
                        listing_count: '5',
                        retail_listings: '2',
                        auction_listings: '3',
                        retail_fee_paid: '2',
                        reached_review: '4',
                        retail_reached_review: '2',
                        auction_reached_review: '2',
                        approved_live: '3',
                        rejected: '1',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'event-1',
                        created_at: new Date('2026-09-21T19:43:30.646Z'),
                        payload: {
                            make: 'VOLKSWAGEN',
                            model: 'ID.3',
                            year: 2025,
                            fuel_type: 'ELECTRIC',
                            listing_type: 'auction',
                            device: 'desktop',
                            city: 'Ilford',
                            country: 'GB',
                            entry_point: 'sell_landing',
                            registration: 'ab12 cde',
                            mileage: 42150,
                            valuation_result: 'figures_returned',
                            valuation_source: 'LIVE_UK_MARKET',
                            valuation_confidence: 'HIGH',
                            valuation_confidence_score: 0.92,
                            valuation_comparables: 8,
                            live_market_status: 'USED',
                            valuation_low: 11600,
                            valuation_mid: 12450,
                            valuation_high: 13300,
                            market_value: 12450,
                            auction_opening_bid: 10750,
                            auction_reserve_low: 11600,
                            auction_reserve_high: 12450,
                            auction_suggested_reserve: 12000,
                            retail_suggested_asking: 13495,
                            retail_suggested_minimum: 12500,
                            user_email: 'must-not-leak@example.com',
                        },
                        started: true,
                        converted: true,
                        listing_id: 'listing-1',
                        converted_listing_type: 'retail',
                        listing_status: 'ACTIVE',
                        listing_vrm: 'ZZ99ZZZ',
                        listing_mileage: 99999,
                        fee_paid: true,
                        reached_review: true,
                        approved_live: true,
                        rejected: false,
                    },
                ]),
        };

        const service = new AnalyticsService(prisma as any);
        const result = await service.getValuationAnalytics();

        expect(result.today).toEqual({
            requests: 18,
            uniqueSessions: 13,
            loggedInUsers: 11,
            loggedInSessions: 11,
            anonymousSessions: 2,
            auctionRequests: 15,
            retailRequests: 3,
            valuationAttempts: 20,
            figuresReturned: 17,
            withoutFigures: 2,
            confirmedNoFigures: 2,
            figureSuccessRate: 85,
            valuationJourneys: 13,
            listingStarted: 8,
            listingCreated: 5,
            uniqueListingsCreated: 5,
            retailListingsCreated: 2,
            auctionListingsCreated: 3,
            retailFeePaid: 2,
            reachedReview: 4,
            retailReachedReview: 2,
            auctionReachedReview: 2,
            approvedLive: 3,
            rejected: 1,
            conversionRate: 38.5,
            approvalRate: 60,
            liveFromValuationRate: 23.1,
        });
        expect(result.hourly[0]).toEqual({ hour: '18:00', requests: 4, sessions: 3 });
        expect(result.last7Days[1]).toEqual({
            date: '2026-09-21',
            requests: 18,
            sessions: 13,
            valuationAttempts: 20,
            figuresReturned: 17,
            withoutFigures: 2,
            confirmedNoFigures: 2,
            figureSuccessRate: 85,
            valuationJourneys: 13,
            listingStarted: 8,
            listingCreated: 5,
            uniqueListingsCreated: 5,
            retailListingsCreated: 2,
            auctionListingsCreated: 3,
            retailFeePaid: 2,
            reachedReview: 4,
            retailReachedReview: 2,
            auctionReachedReview: 2,
            approvedLive: 3,
            rejected: 1,
            conversionRate: 38.5,
            approvalRate: 60,
            liveFromValuationRate: 23.1,
        });
        expect(result.recent[0]).toEqual(expect.objectContaining({
            make: 'VOLKSWAGEN',
            model: 'ID.3',
            year: 2025,
            fuelType: 'ELECTRIC',
            listingType: 'retail',
            device: 'desktop',
            city: 'Ilford',
            country: 'GB',
            entryPoint: 'sell_landing',
            registration: 'AB12CDE',
            mileage: 42150,
            valuationResult: 'figures_returned',
            valuationSource: 'LIVE_UK_MARKET',
            valuationConfidence: 'HIGH',
            valuationConfidenceScore: 0.92,
            valuationComparables: 8,
            liveMarketStatus: 'USED',
            valuationLow: 11600,
            valuationMid: 12450,
            valuationHigh: 13300,
            marketValue: 12450,
            auctionOpeningBid: 10750,
            auctionReserveLow: 11600,
            auctionReserveHigh: 12450,
            auctionSuggestedReserve: 12000,
            retailSuggestedAsking: 13495,
            retailSuggestedMinimum: 12500,
            startedListing: true,
            createdListing: true,
            listingId: 'listing-1',
            listingStatus: 'ACTIVE',
            feePaid: true,
            reachedReview: true,
            approvedLive: true,
            rejected: false,
        }));
        expect(result.recent[0]).not.toHaveProperty('userId');
        expect(result.recent[0]).not.toHaveProperty('sessionId');
        expect(result.recent[0]).not.toHaveProperty('user_email');
        expect(result.timezone).toBe('Europe/London');
        expect(result.attribution).toEqual({
            windowDays: 30,
            exactKey: 'valuation_id',
            historicalFallback: 'session',
        });
    });
});


describe('AnalyticsService auction first-offer analytics', () => {
    it('returns first-offer conversion, competition and audit rows without reconstructing history', async () => {
        const prisma = {
            $queryRawUnsafe: jest
                .fn()
                .mockResolvedValueOnce([{
                    first_offers: '8',
                    unique_auctions: '6',
                    competition_auctions: '4',
                    first_offer_cancellations: '2',
                    seller_accepted_sales: '2',
                    reserve_met_sales: '1',
                    unsold_auctions: '1',
                    pending_auctions: '2',
                    zero_bid_unsold: '5',
                    zero_bid_reserve_corrections: '3',
                    avg_first_offer: '5200.5',
                    avg_reserve_at_first_offer: '7000',
                    avg_percent_below_reserve: '25.7',
                    avg_percent_below_starting: '12.4',
                }])
                .mockResolvedValueOnce([{
                    id: 'event-first-1',
                    created_at: new Date('2026-09-27T10:00:00.000Z'),
                    auction_id: 'auction-1',
                    listing_id: 'listing-1',
                    bid_id: 'bid-1',
                    registration: 'AB12CDE',
                    vehicle: '2022 BMW M3',
                    amount: '4900',
                    starting_bid: '7000',
                    reserve_price: '7000',
                    first_offer_floor: '4900',
                    percent_below_reserve: '30',
                    percent_below_starting: '30',
                    subsequent_bid_count: '3',
                    first_offer_cancelled: false,
                    outcome: 'RESERVE_MET_SALE',
                    outcome_at: new Date('2026-09-27T12:00:00.000Z'),
                }]),
        };

        const service = new AnalyticsService(prisma as any);
        const result = await service.getAuctionFirstOfferAnalytics(30);

        expect(result.windowDays).toBe(30);
        expect(result.summary).toEqual(expect.objectContaining({
            firstOffers: 8,
            uniqueAuctions: 6,
            competitionAuctions: 4,
            competitionRate: 66.7,
            firstOfferCancellations: 2,
            sellerAcceptedSales: 2,
            reserveMetSales: 1,
            completedSales: 3,
            saleRate: 50,
            unsoldAuctions: 1,
            pendingAuctions: 2,
            zeroBidUnsold: 5,
            zeroBidReserveCorrections: 3,
            averageFirstOffer: 5200.5,
            averageReserveAtFirstOffer: 7000,
            averagePercentBelowReserve: 25.7,
            averagePercentBelowStartingBid: 12.4,
        }));
        expect(result.recent[0]).toEqual(expect.objectContaining({
            auctionId: 'auction-1',
            listingId: 'listing-1',
            bidId: 'bid-1',
            registration: 'AB12CDE',
            vehicle: '2022 BMW M3',
            amount: 4900,
            startingBid: 7000,
            reservePrice: 7000,
            firstOfferFloor: 4900,
            percentBelowReserve: 30,
            percentBelowStartingBid: 30,
            subsequentBidCount: 3,
            firstOfferCancelled: false,
            outcome: 'RESERVE_MET_SALE',
        }));
        expect(result.trackingNote).toMatch(/historical auctions are not reconstructed/i);
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
        const summarySql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
        expect(summarySql).toMatch(/COUNT\(DISTINCT auction_run_key\)/);
        expect(summarySql).toMatch(/b\."userId" IS DISTINCT FROM f\.first_bidder_id/);
        expect(prisma.$queryRawUnsafe.mock.calls[0][0]).toContain("auction_run_key");
        expect(prisma.$queryRawUnsafe.mock.calls[1][0]).toContain("auction_run_key");
    });

    it('clamps the reporting window to a safe range', async () => {
        const prisma = {
            $queryRawUnsafe: jest
                .fn()
                .mockResolvedValueOnce([{
                    first_offers: '0',
                    unique_auctions: '0',
                    competition_auctions: '0',
                    first_offer_cancellations: '0',
                    seller_accepted_sales: '0',
                    reserve_met_sales: '0',
                    unsold_auctions: '0',
                    pending_auctions: '0',
                    zero_bid_unsold: '0',
                    zero_bid_reserve_corrections: '0',
                    avg_first_offer: null,
                    avg_reserve_at_first_offer: null,
                    avg_percent_below_reserve: null,
                    avg_percent_below_starting: null,
                }])
                .mockResolvedValueOnce([]),
        };

        const service = new AnalyticsService(prisma as any);
        const result = await service.getAuctionFirstOfferAnalytics(99999);

        expect(result.windowDays).toBe(365);
    });
});
