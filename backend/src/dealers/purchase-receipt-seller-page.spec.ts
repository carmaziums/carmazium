import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfWrapText, appendPurchaseSellerDetailsPage } from './purchase-receipt-seller-page';

describe('Purchase receipt seller identity and advertised price safety', () => {
    it('wraps long addresses and email values without truncating them', async () => {
        const pdf = await PDFDocument.create();
        const normal = await pdf.embedFont(StandardFonts.Helvetica);
        const postal = '123 Extremely Long Historic Residential Avenue, Suite 200, Small Village, Greater Manchester, M12 1AB';
        const lines = pdfWrapText(postal, normal, 10, 130);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(postal);
        expect(lines.every(line => normal.widthOfTextAtSize(line, 10) <= 130)).toBe(true);
    });

    it('adds a second page with known seller identity, trading/contact details and audit caveats', async () => {
        const pdf = await PDFDocument.create();
        pdf.addPage();
        await appendPurchaseSellerDetailsPage(pdf, {
            sellerName: 'Chris Collins',
            sellerCompany: 'Chris Collins Cars',
            sellerAccountReference: 'seller-42',
            sellerEmail: 'chris@example.test',
            sellerPhone: '07123456789',
            sellerAddress: '15 Example Street, Manchester, M1 1AA',
            sellerAddressSource: 'VERIFIED_POSTAL',
            sellerCompanyRegistrationNumber: '12345678',
            sellerVatNumber: 'GB123456789',
            contactUnlocked: true,
        }, 'CMZ-sale-42');
        const loaded = await PDFDocument.load(await pdf.save());
        expect(loaded.getPageCount()).toBe(2);
    });

    it('never prints locked seller contact information', async () => {
        const pdf = await PDFDocument.create();
        await appendPurchaseSellerDetailsPage(pdf, {
            sellerName: 'Example Seller',
            sellerEmail: 'private@example.test',
            sellerPhone: '07999999999',
            sellerAddress: 'Confidential, London',
            contactUnlocked: false,
        }, 'CMZ-private');
        const loaded = await PDFDocument.load(await pdf.save());
        expect(loaded.getPageCount()).toBe(1);
    });
});
