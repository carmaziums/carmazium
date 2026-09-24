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
                            user_email: 'must-not-leak@example.com',
                        },
                        started: true,
                        converted: true,
                        listing_id: 'listing-1',
                        converted_listing_type: 'retail',
                        listing_status: 'ACTIVE',
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
