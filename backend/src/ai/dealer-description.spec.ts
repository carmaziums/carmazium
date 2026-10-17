import { dealerDescriptionAppendix, dealerPublicArea, publicDealerCopy } from './dealer-description';
import { AiService } from './ai.service';

describe('Dealer-enriched MaziuM vehicle descriptions', () => {
    it('appends only actual dealer terms and a general area, never direct contact details', () => {
        const text = dealerDescriptionAppendix({
            companyName: 'Example Motors',
            businessAddress: '181 Example Road, Birmingham, B19 1ES',
            description: 'Independent car retailer. Visit www.dealer.example or call 0121 555 1234.',
            warrantyOffered: true,
            warrantyDetails: '30-day engine and gearbox cover up to £2,000, subject to written exclusions.',
            financeOffered: true,
            financeDetails: 'Finance introduced by a regulated broker, subject to status and lender approval.',
        });
        expect(text).toContain('About the dealer: Example Motors — based in Birmingham.');
        expect(text).toContain('Independent car retailer.');
        expect(text).toContain('30-day engine and gearbox cover');
        expect(text).toContain('subject to eligibility and lender approval');
        expect(text).not.toContain('181 Example Road');
        expect(text).not.toContain('B19 1ES');
        expect(text).not.toContain('www.dealer.example');
        expect(text).not.toContain('0121 555 1234');
    });

    it('omits warranty and finance entirely when not offered or incomplete', () => {
        expect(dealerDescriptionAppendix({
            companyName: 'Example Motors',
            warrantyOffered: false,
            warrantyDetails: 'Old 12-month claim',
            financeOffered: true,
            financeDetails: '',
        })).toBe('About the dealer: Example Motors.');
        expect(dealerDescriptionAppendix(null)).toBe('');
        expect(dealerPublicArea('Only a postcode B19 1ES')).toBe('');
        expect(publicDealerCopy('Call +44 7123 456789')).not.toContain('7123');
    });

    it('redacts precise addresses, postcodes, bare domains and social handles in dealer-provided text', () => {
        const appendix = dealerDescriptionAppendix({
            companyName: 'Example Motors',
            businessAddress: 'Birmingham',
            description: 'Independent local dealer, 181 Example Road, B19 1ES. Visit examplemotors.co.uk or @examplemotors.',
            warrantyOffered: true,
            warrantyDetails: '30-day engine and gearbox warranty. Call 0121 555 1234 for details.',
            financeOffered: false,
        });
        expect(appendix).toContain('based in Birmingham.');
        expect(appendix).toContain('30-day engine and gearbox warranty');
        for (const prohibited of ['181 Example Road', 'B19 1ES', 'examplemotors.co.uk', '@examplemotors', '0121 555 1234']) {
            expect(appendix).not.toContain(prohibited);
        }
        expect(dealerPublicArea('Birmingham, West Midlands')).toBe('Birmingham, West Midlands');
        expect(dealerPublicArea('Regent Street')).toBe('');
        expect(dealerPublicArea('181 Example Road')).toBe('');
    });

    it('redacts contacts accidentally repeated in the AI vehicle section, keeping paragraph breaks', async () => {
        const prisma: any = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            dealerStaff: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const service = new AiService({ get: () => 'test-key' } as any, prisma);
        (service as any).openai = {
            chat: { completions: { create: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Reliable hatchback.\n\nFind us at 12 Example Street, B19 1ES or seller.co.uk.\n\nManual gearbox.' } }],
            }) } },
            moderations: { create: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }) },
        };
        const { text } = await service.generateDescription({ make: 'Ford' }, 'owner-id');
        expect(text).toContain('Reliable hatchback.\n\n');
        expect(text).toContain('\n\nManual gearbox.');
        expect(text).not.toContain('12 Example Street');
        expect(text).not.toContain('B19 1ES');
        expect(text).not.toContain('seller.co.uk');
    });

    it('sources the dealer profile on the backend for an authenticated dealer, not from a spoofed request', async () => {
        const dealerProfile = {
            companyName: 'Real Dealer',
            businessAddress: '1 Workshop Street, Leeds, LS1 1AA',
            description: 'Family-run business',
            warrantyOffered: false, warrantyDetails: null,
            financeOffered: true, financeDetails: 'Subject to status, terms apply',
        };
        const prisma: any = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(dealerProfile) },
            dealerStaff: { findMany: jest.fn() },
        };
        const service = new AiService({ get: () => 'test-key' } as any, prisma);
        (service as any).openai = {
            chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'A well-presented hatchback with manual transmission.' } }] }) } },
            moderations: { create: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }) },
        };
        const output = await service.generateDescription({
            aiConsentAcknowledged: true,
            make: 'Ford',
            model: 'Fiesta',
            companyName: 'Fake Dealer',
            warrantyDetails: 'Guaranteed lifetime warranty',
        }, 'owner-id');
        expect(output.text).toContain('Real Dealer');
        expect(output.text).toContain('Leeds');
        expect(output.text).not.toContain('Fake Dealer');
        expect(output.text).not.toContain('Guaranteed lifetime warranty');
        expect(output.text).not.toContain('1 Workshop Street');
        expect(prisma.dealerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-id' } }));
    });

    it('uses a single active staff membership, but never guesses between multiple dealer identities', async () => {
        const prisma: any = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            dealerStaff: { findMany: jest.fn().mockResolvedValue([
                { dealerProfile: { companyName: 'Dealer A' } },
                { dealerProfile: { companyName: 'Dealer B' } },
            ]) },
        };
        const service = new AiService({ get: () => 'test-key' } as any, prisma);
        (service as any).openai = {
            chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Vehicle description only.' } }] }) } },
            moderations: { create: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }) },
        };
        const output = await service.generateDescription({ make: 'Audi' }, 'staff-id');
        expect(output.text).toBe('Vehicle description only.');
    });
});
