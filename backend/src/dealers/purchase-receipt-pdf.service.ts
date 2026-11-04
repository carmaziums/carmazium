import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { DealersService } from './dealers.service';
import { PrismaService } from '../prisma/prisma.service';
import { appendPurchaseSellerDetailsPage } from './purchase-receipt-seller-page';
import { readPurchaseSellerLegalSnapshot } from './purchase-seller-legal-snapshot';

/**
 * A buyer's account-keeping record of a collected vehicle, NOT a Carmazium
 * invoice or a statement that Carmazium received the vehicle sale proceeds.
 * Access is checked against the existing VIEW_PURCHASES + buyer-fee gates.
 */
@Injectable()
export class PurchaseReceiptPdfService {
    constructor(
        private readonly dealers: DealersService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Owner-confirmed reconciliation PDF, intentionally distinct from a
     * seller-issued receipt. It contains no fictional price or VAT claim.
     */
    async renderForReconciled(id: string, requesterId: string): Promise<Buffer> {
        const purchase = await this.dealers.getDealerReconciledPurchaseDetail(requesterId, id);
        const seller = await this.dealers.getDealerReconciledPurchaseSellerDetails(requesterId, id);
        const pdf = await PDFDocument.create();
        pdf.setTitle('CarMazium owner-confirmed vehicle purchase record');
        pdf.setAuthor('CarMazium');
        pdf.setSubject('Owner-confirmed historic purchase and physical collection record');
        const page = pdf.addPage([595.28, 841.89]);
        const normal = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const ink = rgb(0.10, 0.14, 0.21);
        const red = rgb(0.76, 0.09, 0.16);
        const grey = rgb(0.35, 0.38, 0.43);
        const white = rgb(1, 1, 1);
        const safe = (value: string) => value.normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '-').slice(0, 88);
        const date = new Date(purchase.collectedAt + 'T12:00:00Z').toLocaleDateString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
        });
        const price = purchase.purchasePrice === null ? 'Not recorded' :
            '£' + purchase.purchasePrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const advertised = purchase.advertisedPrice == null ? 'Not recorded'
            : '£' + purchase.advertisedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        page.drawRectangle({ x: 0, y: 723, width: 595.28, height: 119, color: ink });
        page.drawRectangle({ x: 48, y: 776, width: 6, height: 28, color: red });
        page.drawText('CARMAZIUM', { x: 65, y: 781, size: 23, color: white, font: bold });
        page.drawText('OWNER-CONFIRMED VEHICLE PURCHASE', { x: 48, y: 749, size: 13, color: white, font: bold });
        const row = (label: string, value: string, y: number) => {
            page.drawText(label, { x: 48, y, font: normal, size: 10, color: grey });
            page.drawText(safe(value), { x: 210, y, font: bold, size: 11, color: ink });
            page.drawLine({ start: { x: 48, y: y - 12 }, end: { x: 546, y: y - 12 }, thickness: 0.5, color: rgb(0.88,0.88,0.90) });
        };
        row('Reference', 'CMZ-REC-' + id.toUpperCase(), 683);
        row('Purchase status', 'COMPLETED - owner confirmed', 645);
        row('Collected', date, 607);
        row('Registration', purchase.registration, 569);
        row('Vehicle', purchase.vehicleTitle, 531);
        row('Final agreed price', price, 493);
        row('Advertised price on file', advertised, 455);
        row('Original auction seller', purchase.sellerName, 417);
        row('Original listing date', new Date(purchase.originalListedAt + 'T12:00:00Z')
            .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London' }), 379);
        row('Original listing ID', purchase.originalAuctionListingId, 341);
        page.drawText('RECONCILIATION NOTICE', { x: 48, y: 289, size: 13, font: bold, color: red });
        const notice = [
            'The buyer confirms purchasing from the original CarMazium auction seller.',
            'The original seller listing is the source, not the buyer\'s retail stock.',
            'The historic auction result was NOT changed by this reconciliation.',
            'Advertised price is the original listing value currently on file.',
            'It may have changed since listing or collection; it is not the final price.',
            'Listing last updated: ' + new Date(purchase.advertisedPriceLastUpdatedAt)
                .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/London' }) + '.',
            'Final agreed price is shown only when separately recorded.',
            'CarMazium has not independently verified payment to the seller.',
            'This record is not a seller invoice, VAT invoice or proof of payment.',
            'Keep the original seller invoice and bank statement for your accounts.',
        ];
        notice.forEach((line, i) => page.drawText(line, {
            x: 48, y: 265 - i * 21, size: 10, font: normal, color: grey,
        }));
        page.drawText('CarMazium - carmazium.com', {
            x: 48, y: 56, size: 10, font: normal, color: ink,
        });
        await appendPurchaseSellerDetailsPage(pdf, seller, 'CMZ-REC-' + id.toUpperCase());
        return Buffer.from(await pdf.save());
    }

    async renderForPurchase(saleId: string, requesterId: string): Promise<Buffer> {
        const purchase = await this.dealers.getDealerPurchaseDetail(requesterId, saleId);
        if (!purchase.buyerCollectedAt) {
            throw new ConflictException('Confirm vehicle collection before downloading the purchase record');
        }
        if (purchase.channel === 'AUCTION' && !purchase.buyerFee.settled) {
            throw new NotFoundException('Purchase record unavailable');
        }

        const seller = await this.dealers.getPurchaseSellerDetails(requesterId, saleId);
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            select: {
                buyerId: true,
                buyer: {
                    select: {
                        firstName: true, lastName: true, email: true,
                        dealerProfile: {
                            select: { companyName: true, businessAddress: true },
                        },
                    },
                },
            },
        });
        if (!sale?.buyer || !sale.buyerId) throw new NotFoundException('Purchase not found');
        // Fee/VIEW_PURCHASES restrictions above run BEFORE any private snapshot read.
        const frozen = await readPurchaseSellerLegalSnapshot(this.prisma, saleId, sale.buyerId);
        const sellerForPdf = frozen && seller.contactUnlocked
            ? { ...seller, ...frozen, contactUnlocked: true,
                sellerDataCapturedAt: frozen.capturedAt,
                sellerDataSource: frozen.capturedAtSource }
            : { ...seller, sellerDataCapturedAt: null,
                sellerDataSource: 'CURRENT_PROFILE' as const };
        const advertisedPriceAtCapture = frozen?.advertisedPriceAtCapture;
        const displayAdvertisedPrice = purchase.advertisedPriceSource === 'PURCHASE_SNAPSHOT'
            ? purchase.advertisedPrice
            : advertisedPriceAtCapture ?? purchase.advertisedPrice;
        const displayAdvertisedSource = purchase.advertisedPriceSource === 'PURCHASE_SNAPSHOT'
            ? 'PURCHASE_SNAPSHOT'
            : advertisedPriceAtCapture !== null && advertisedPriceAtCapture !== undefined
                ? frozen?.capturedAtSource || 'RECORDED_NEAR_SALE'
                : 'CURRENT_LISTING';

        const buyer = sale.buyer;
        const buyerName = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || buyer.email;
        const sellerName = sellerForPdf.sellerCompany || sellerForPdf.sellerName;
        const registration = purchase.vehicle.registration || 'Not recorded';
        const pdf = await PDFDocument.create();
        pdf.setTitle('CarMazium vehicle purchase record');
        pdf.setSubject('Collected vehicle sale record for buyer accounting');
        pdf.setAuthor('CarMazium');
        const page = pdf.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const normal = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const red = rgb(0.77, 0.07, 0.15);
        const navy = rgb(0.08, 0.12, 0.2);
        const grey = rgb(0.38, 0.41, 0.46);
        const pale = rgb(0.96, 0.96, 0.97);
        const white = rgb(1, 1, 1);

        // Helvetica uses WinAnsi; remove unsupported Unicode rather than
        // crashing the download for a customer with a non-Latin name.
        const clean = (value: string | number | null | undefined) => String(value ?? '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '-');
        const oneLine = (value: string, font: PDFFont, size: number, maxWidth: number) => {
            let text = clean(value);
            while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) text = text.slice(0, -1);
            return text;
        };
        const date = (value: string) => new Date(value).toLocaleDateString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/London',
        });
        const money = (n: number) => '£' + n.toLocaleString('en-GB', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        });
        const row = (label: string, value: string, y: number) => {
            page.drawText(label, { x: 48, y, font: normal, size: 10, color: grey });
            page.drawText(oneLine(value, bold, 11, 330), { x: 215, y, font: bold, size: 11, color: navy });
            page.drawLine({ start: { x: 48, y: y - 11 }, end: { x: width - 48, y: y - 11 }, thickness: 0.5, color: pale });
        };
        const heading = (label: string, y: number) =>
            page.drawText(label, { x: 48, y, font: bold, size: 12, color: red });

        page.drawRectangle({ x: 0, y: height - 112, width, height: 112, color: navy });
        page.drawRectangle({ x: 48, y: height - 65, width: 6, height: 32, color: red });
        page.drawText('CARMAZIUM', { x: 65, y: height - 61, font: bold, size: 23, color: white });
        page.drawText('VEHICLE PURCHASE RECORD', { x: 48, y: height - 91, font: bold, size: 13, color: white });

        row('Record reference', 'CMZ-' + saleId.toUpperCase(), 699);
        row('Sale recorded', date(purchase.purchasedAt), 671);
        row('Buyer confirmed collection', date(purchase.buyerCollectedAt), 643);
        row('Purchase channel', purchase.channel === 'RETAIL' ? 'Retail' : 'Auction', 615);

        heading('VEHICLE', 573);
        row('Make and model', [purchase.vehicle.make, purchase.vehicle.model].filter(Boolean).join(' ') || purchase.vehicle.title, 549);
        row('Year', String(purchase.vehicle.year ?? 'Not recorded'), 524);
        row('Registration', registration, 499);
        row('Mileage', purchase.vehicle.mileage != null
            ? purchase.vehicle.mileage.toLocaleString('en-GB') + ' miles' : 'Not recorded', 474);

        heading('PARTIES', 435);
        row('Buyer', buyer.dealerProfile?.companyName || buyerName, 411);
        row('Buyer account', buyerName, 386);
        if (buyer.dealerProfile?.businessAddress) {
            row('Buyer business address', buyer.dealerProfile.businessAddress, 361);
        }
        const sellerY = buyer.dealerProfile?.businessAddress ? 336 : 361;
        row('Seller', sellerName, sellerY);
        // Full seller contact and postal address are on page 2. This first
        // page shows both the actual deal and the distinct advertisement.
        const priceY = sellerY - 47;
        heading('VEHICLE PRICES (SEPARATE AMOUNTS)', priceY);
        page.drawRectangle({ x: 48, y: priceY - 91, width: width - 96, height: 78, color: pale });
        page.drawText('Final agreed purchase price', { x: 63, y: priceY - 29, font: bold, size: 9, color: grey });
        page.drawText(money(purchase.purchasePrice), { x: 63, y: priceY - 51, font: bold, size: 18, color: navy });
        page.drawText('Advertisement price on file', { x: 290, y: priceY - 29, font: bold, size: 9, color: grey });
        page.drawText(displayAdvertisedPrice == null ? 'Not recorded' : money(displayAdvertisedPrice), {
            x: 290, y: priceY - 51, font: bold, size: 18, color: navy,
        });

        const paymentNote = purchase.payment.sellerFundsConfirmedAt
            ? 'Seller funds confirmation recorded: ' + date(purchase.payment.sellerFundsConfirmedAt) + '.'
            : 'CarMazium has not independently verified vehicle payment.';
        page.drawText(oneLine(paymentNote, normal, 9, width - 96), {
            x: 48, y: 185, font: normal, size: 9, color: grey,
        });
        page.drawLine({ start: { x: 48, y: 164 }, end: { x: width - 48, y: 164 }, thickness: 0.8, color: grey });
        const notes = [
            'Advertised price is ' + (displayAdvertisedSource === 'PURCHASE_SNAPSHOT'
                ? 'from the retained advert snapshot.'
                : displayAdvertisedSource === 'RECORDED_NEAR_SALE'
                    ? 'from a seller evidence snapshot captured near sale recording.'
                    : displayAdvertisedSource === 'CAPTURED_AFTER_SALE'
                        ? 'from a later snapshot; it may differ from the price at sale.'
                        : 'the current listing value; it may differ from the price at sale.'),
            'Advertised price is NOT evidence of the final agreed or paid price.',
            'Price source last recorded: ' + (purchase.advertisedPriceRecordedAt
                ? date(purchase.advertisedPriceRecordedAt)
                : 'Date unavailable') + '.',
            'Vehicle purchase money is paid directly by the buyer to the seller, not to CarMazium.',
            'This is not a seller-issued invoice, a VAT invoice, or independent proof of payment.',
            'Retain the seller\'s invoice and bank transfer evidence for your accounting records.',
        ];
        notes.forEach((line, i) => page.drawText(line, {
            x: 48, y: 145 - i * 15, font: normal, size: 8.7, color: grey,
        }));
        page.drawText('Issued from CarMazium purchase records · carmazium.com', {
            x: 48, y: 43, font: normal, size: 9, color: grey,
        });
        await appendPurchaseSellerDetailsPage(pdf, sellerForPdf, 'CMZ-' + saleId.toUpperCase());
        return Buffer.from(await pdf.save());
    }
}
