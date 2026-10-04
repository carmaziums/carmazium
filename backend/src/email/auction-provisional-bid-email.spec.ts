import { EmailService } from './email.service';

describe('provisional auction buyer email', () => {
    it('explains that a below-reserve highest bid is not a win and only the seller can decide', async () => {
        const service: any = Object.create(EmailService.prototype);
        service.frontendUrl = 'https://www.carmazium.com';
        service.sendBrandedEmail = jest.fn().mockResolvedValue({ id: 'test-message' });

        await service.sendAuctionProvisionalBidBuyerEmail({
            toEmail: 'buyer@example.com',
            buyerName: 'A <buyer>',
            vehicleTitle: 'BMW <M3>',
            amount: 7000,
            auctionId: 'auction-1',
        });

        expect(service.sendBrandedEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'buyer@example.com',
            subject: expect.stringContaining('seller decision pending'),
        }));
        const html = service.sendBrandedEmail.mock.calls[0][0].bodyHtml as string;
        expect(html).toContain('£7,000');
        expect(html).toContain('The seller can accept your offer');
        expect(html).toContain('You have not won the vehicle yet');
        expect(html).toContain('we will send a separate winning notification');
        expect(html).toContain('https://www.carmazium.com/auctions/live/auction-1');
        expect(html).toContain('A &lt;buyer&gt;');
        expect(html).toContain('BMW &lt;M3&gt;');
        expect(html).not.toContain('<buyer>');
    });
});


describe('branded auction-email contrast', () => {
    const makeService = () => {
        const service: any = Object.create(EmailService.prototype);
        service.frontendUrl = 'https://www.carmazium.com';
        service.logoUrl = 'https://www.carmazium.com/assets/images/logo.png';
        service.dispatch = jest.fn().mockResolvedValue({ id: 'test-message' });
        return service;
    };

    it('uses explicit accessible inline colours for buyer and seller provisional notices', async () => {
        const service = makeService();
        await service.sendAuctionProvisionalBidBuyerEmail({
            toEmail: 'buyer@example.com',
            buyerName: 'Buyer',
            vehicleTitle: 'Toyota Yaris',
            amount: 4000,
            auctionId: 'auction-1',
        });
        const buyerHtml = service.dispatch.mock.calls[0][0].html as string;
        expect(buyerHtml).toMatch(/<h1 style="[^"]*color: #ffffff;">Your bid is provisional/);
        expect(buyerHtml).toMatch(/<p style="[^"]*color: #e2e8f0;">Hello Buyer/);
        expect(buyerHtml).toMatch(/<a href="https:\/\/www\.carmazium\.com\/auctions\/live\/auction-1" style="[^"]*color: #93c5fd;/);
        expect(buyerHtml).toContain('background-color: #1e293b;');
        expect(buyerHtml).toContain('.carmazium-email-content { padding: 28px 20px !important; }');

        await service.sendAuctionProvisionalOfferEmail({
            toEmail: 'seller@example.com',
            sellerName: 'Seller',
            vehicleTitle: 'Toyota Yaris',
            amount: 4000,
            reservePrice: 5000,
            auctionId: 'auction-1',
            ended: true,
        });
        const sellerHtml = service.dispatch.mock.calls[1][0].html as string;
        expect(sellerHtml).toMatch(/<h1 style="[^"]*color: #ffffff;">Provisionally sold/);
        expect(sellerHtml).toMatch(/<p style="[^"]*color: #e2e8f0;">Hello Seller/);
        expect(sellerHtml).toMatch(/<a href="[^"]+" style="[^"]*color: #93c5fd;/);
    });

    it('preserves existing inline email designs while styling only legacy bare tags', () => {
        const service = makeService();
        const html: string = service.wrapInBrandTemplate(
            '<h1 style="color: #ffffff;">Existing title</h1>' +
            '<p style="color: #cbd5e1;">Existing paragraph</p>' +
            '<a href="https://www.carmazium.com" style="color: #ffffff;">Existing action</a>' +
            '<h2>Unstyled heading</h2><p>Unstyled paragraph</p>',
        );
        expect(html).toContain('<h1 style="color: #ffffff;">Existing title</h1>');
        expect(html).toContain('<p style="color: #cbd5e1;">Existing paragraph</p>');
        expect(html).toContain('<a href="https://www.carmazium.com" style="color: #ffffff;">Existing action</a>');
        expect(html).toMatch(/<h2 style="[^"]*color: #ffffff;">Unstyled heading/);
        expect(html).toMatch(/<p style="[^"]*color: #e2e8f0;">Unstyled paragraph/);
    });

    it('styles the unstyled buyer fee reminder through the same shared wrapper', async () => {
        const service = makeService();
        await service.sendAuctionBuyerFeeReminderEmail({
            toEmail: 'buyer@example.com',
            vehicleTitle: 'Toyota Yaris',
            deadline: new Date('2026-10-05T12:00:00Z'),
            hoursStage: 24,
        });
        const html: string = service.dispatch.mock.calls[0][0].html;
        expect(html).toMatch(/<h1 style="[^"]*color: #ffffff;">Your auction buyer fee is due/);
        expect(html).toMatch(/<p style="[^"]*color: #e2e8f0;">The £125 platform fee/);
    });
});
