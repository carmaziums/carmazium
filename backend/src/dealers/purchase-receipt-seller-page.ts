import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

/**
 * The buyer-visible seller details from a completed purchase. Data come only
 * from seller contact/profile or account-confirmed postal address records. NEVER add
 * KYC documents, seller bank details, raw identity proofs or guessed addresses.
 */
export interface PurchaseReceiptSellerDetails {
    sellerName: string;
    sellerCompany?: string | null;
    sellerAccountReference?: string | null;
    sellerEmail?: string | null;
    sellerPhone?: string | null;
    sellerAddress?: string | null;
    sellerAddressSource?: 'BUSINESS' | 'VERIFIED_POSTAL' | 'ACCOUNT_CONFIRMED_POSTAL' | null;
    sellerDataCapturedAt?: string | null;
    sellerDataSource?: 'RECORDED_NEAR_SALE' | 'CAPTURED_AFTER_SALE' | 'CURRENT_PROFILE' | null;
    sellerCompanyRegistrationNumber?: string | null;
    sellerVatNumber?: string | null;
    contactUnlocked: boolean;
}

const ink = rgb(0.10, 0.14, 0.21);
const light = rgb(0.38, 0.41, 0.45);
const red = rgb(0.78, 0.08, 0.16);
const pale = rgb(0.91, 0.92, 0.93);
const white = rgb(1, 1, 1);
const PAGE_WIDTH = 595.28;

export const pdfSafeText = (value: string | null | undefined) =>
    String(value ?? 'Not recorded').normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '-');

/** Never silently truncate evidence such as postal addresses or phone numbers. */
export const pdfWrapText = (value: string, font: PDFFont, size: number, maxWidth: number) => {
    const text = pdfSafeText(value);
    const chunks: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
            if (!word) continue;
            const trial = line ? line + ' ' + word : word;
            if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
                line = trial;
            } else {
                if (line) chunks.push(line);
                line = '';
                // Very long unbroken account numbers and emails wrap rather than clipping.
                for (const char of word) {
                    if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) {
                        chunks.push(line);
                        line = '';
                    }
                    line += char;
                }
            }
        }
        chunks.push(line);
    }
    return chunks;
};

export async function appendPurchaseSellerDetailsPage(
    pdf: PDFDocument,
    seller: PurchaseReceiptSellerDetails,
    purchaseReference: string,
): Promise<void> {
    const page: PDFPage = pdf.addPage([PAGE_WIDTH, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    page.drawRectangle({ x: 0, y: 739, width: PAGE_WIDTH, height: 103, color: ink });
    page.drawRectangle({ x: 48, y: 783, width: 5, height: 27, color: red });
    page.drawText('CARMAZIUM', { x: 65, y: 790, font: bold, size: 21, color: white });
    page.drawText('SELLER DETAILS - PURCHASE RECORD', { x: 48, y: 759, font: bold, size: 12, color: white });

    let y = 704;
    const row = (label: string, rawValue: string | null | undefined) => {
        page.drawText(label, { x: 48, y, font: bold, size: 10, color: ink });
        const lines = pdfWrapText(rawValue?.trim() || 'Not recorded', font, 10, 322);
        for (const text of lines) {
            page.drawText(text, { x: 214, y, font, size: 10, color: light });
            y -= 16;
        }
        y -= 17;
        page.drawLine({ start: { x: 48, y: y + 8 }, end: { x: 547, y: y + 8 }, color: pale, thickness: 0.6 });
    };

    row('Purchase reference', purchaseReference);
    row('Seller details source', seller.sellerDataSource === 'RECORDED_NEAR_SALE'
        ? 'Private account snapshot near sale recording'
        : seller.sellerDataSource === 'CAPTURED_AFTER_SALE'
            ? 'Private account snapshot captured after sale'
            : 'Current account information - not a historic snapshot');
    row('Seller details captured', seller.sellerDataCapturedAt || 'Not captured historically');
    row('Seller full name', seller.sellerName);
    row('Business/trading name', seller.sellerCompany);
    row('Seller account reference', seller.sellerAccountReference);
    if (seller.contactUnlocked) {
        row('Email on file', seller.sellerEmail);
        row('Telephone on file', seller.sellerPhone);
        row(seller.sellerAddressSource === 'BUSINESS' ? 'Business address on file'
            : seller.sellerAddressSource === 'VERIFIED_POSTAL'
                || seller.sellerAddressSource === 'ACCOUNT_CONFIRMED_POSTAL'
                ? 'Account-confirmed postal address' : 'Seller postal address',
            seller.sellerAddress);
        row('Company registration no.', seller.sellerCompanyRegistrationNumber);
        row('VAT number on file', seller.sellerVatNumber);
    } else {
        row('Seller contact details', 'Locked - buyer fee has not been settled');
    }

    // These details can be absent or changed after the transaction. Distinguish
    // current account data from a contemporaneous signed seller invoice.
    const footer = [
        seller.sellerDataSource === 'RECORDED_NEAR_SALE'
            ? 'Identity details were captured near the sale record and may since have changed.'
            : seller.sellerDataSource === 'CAPTURED_AFTER_SALE'
                ? 'Identity details were captured after sale, not necessarily at the original handover.'
                : 'Identity details are from the current seller account, not a historical snapshot.',
        'Account-confirmed postal address means email-code confirmation, NOT verified residence.',
        'Account contact, company and VAT details are not independently certified by this PDF.',
        'If a field says "Not recorded", request it from the seller for your legal records.',
        'This is not a seller-issued invoice, a VAT invoice or independent proof of payment.',
        'No private identity documents or bank account information are included.',
    ];
    page.drawLine({ start: { x: 48, y: 219 }, end: { x: 547, y: 219 }, color: pale, thickness: 1 });
    footer.forEach((note, index) => {
        page.drawText(note, { x: 48, y: 201 - index * 20, font, size: 8.7, color: light });
    });
    page.drawText('Private buyer accounting copy - carmazium.com', {
        x: 48, y: 47, font: bold, size: 9, color: ink,
    });
}
