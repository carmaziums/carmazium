import { AuctionGateway } from './auction.gateway';

describe('AuctionGateway Trade Exchange access', () => {
    let authService: any;
    let prisma: any;
    let gateway: AuctionGateway;
    let server: any;

    const makeClient = (overrides: any = {}) => ({
        id: 'socket-1',
        data: {},
        request: { session: {} },
        handshake: { auth: {}, query: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        rooms: new Set<string>(),
        ...overrides,
    });

    beforeEach(() => {
        authService = { verifySupabaseToken: jest.fn() };
        prisma = {
            auction: { findUnique: jest.fn() },
            user: { findUnique: jest.fn() },
        };
        gateway = new AuctionGateway(authService, prisma);
        server = {
            in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
            to: jest.fn().mockReturnValue({ emit: jest.fn() }),
        };
        (gateway as any).server = server;
    });

    it('disconnects an unauthenticated socket', async () => {
        const client = makeClient();
        await gateway.handleConnection(client as any);
        expect(client.disconnect).toHaveBeenCalledWith(true);
        expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    });

    it('does not let an unverified dealer join an auction room', async () => {
        const client = makeClient({ data: { userId: 'dealer-1' } });
        prisma.auction.findUnique.mockResolvedValue({
            deletedAt: null,
            listing: { sellerId: 'seller-1' },
        });
        prisma.user.findUnique.mockResolvedValue({
            role: 'DEALER',
            dealerProfile: { isVerified: false },
        });

        await gateway.handleJoin(client as any, { auctionId: 'auction-1' });

        expect(client.join).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'TRADE_ACCESS_DENIED' }));
    });

    it('allows the seller to join their own auction room', async () => {
        const client = makeClient({ data: { userId: 'seller-1' } });
        prisma.auction.findUnique.mockResolvedValue({
            deletedAt: null,
            listing: { sellerId: 'seller-1' },
        });

        await gateway.handleJoin(client as any, { auctionId: 'auction-1' });

        expect(client.join).toHaveBeenCalledWith('auction:auction-1');
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('allows a verified dealer to join an auction room', async () => {
        const client = makeClient({ data: { userId: 'dealer-1' } });
        prisma.auction.findUnique.mockResolvedValue({
            deletedAt: null,
            listing: { sellerId: 'seller-1' },
        });
        prisma.user.findUnique.mockResolvedValue({
            role: 'DEALER',
            dealerProfile: { isVerified: true },
        });

        await gateway.handleJoin(client as any, { auctionId: 'auction-1' });

        expect(client.join).toHaveBeenCalledWith('auction:auction-1');
    });
});
