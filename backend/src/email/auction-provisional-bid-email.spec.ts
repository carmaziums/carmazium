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
