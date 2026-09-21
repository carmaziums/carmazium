import { AnalyticsService } from './analytics.service';

describe('AnalyticsService live valuation analytics', () => {
    it('returns admin-safe real-time valuation aggregates', async () => {
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
                }])
                .mockResolvedValueOnce([
                    { hour: '18:00', requests: '4', sessions: '3' },
                    { hour: '19:00', requests: '2', sessions: '2' },
                ])
                .mockResolvedValueOnce([
                    { date: '2026-09-20', requests: '9', sessions: '7' },
                    { date: '2026-09-21', requests: '18', sessions: '13' },
                ]),
            analyticsEvent: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'event-1',
                        createdAt: new Date('2026-09-21T21:43:30.646Z'),
                        payload: {
                            make: 'VOLKSWAGEN',
                            year: 2025,
                            fuel_type: 'ELECTRIC',
                            listing_type: 'auction',
                            device: 'desktop',
                            city: 'Ilford',
                            country: 'GB',
                            user_email: 'must-not-leak@example.com',
                        },
                    },
                ]),
            },
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
        });
        expect(result.hourly[0]).toEqual({ hour: '18:00', requests: 4, sessions: 3 });
        expect(result.last7Days[1]).toEqual({ date: '2026-09-21', requests: 18, sessions: 13 });
        expect(result.recent[0]).toEqual(expect.objectContaining({
            make: 'VOLKSWAGEN',
            year: 2025,
            fuelType: 'ELECTRIC',
            listingType: 'auction',
            device: 'desktop',
            city: 'Ilford',
            country: 'GB',
        }));
        expect(result.recent[0]).not.toHaveProperty('userId');
        expect(result.recent[0]).not.toHaveProperty('sessionId');
        expect(result.recent[0]).not.toHaveProperty('user_email');
        expect(result.timezone).toBe('Europe/London');
    });
});
