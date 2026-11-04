import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { DealersService } from './dealers.service';
import { PrismaService } from '../prisma/prisma.service';

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
        row('Purchase price', price, 493);
        page.drawText('RECONCILIATION NOTICE', { x: 48, y: 430, size: 13, font: bold, color: red });
        const notice = [
            'The buyer confirms purchasing and collecting this vehicle.',
            'CarMazium recovered this missing record after website development.',
            'The historic auction result was NOT changed by this reconciliation.',
            'The purchase price is shown only if separately recorded and verified.',
            'CarMazium has not independently verified payment to the seller.',
            'This record is not a seller invoice, VAT invoice or proof of payment.',
            'Keep the original seller invoice and bank statement for your accounts.',
        ];
        notice.forEach((line, i) => page.drawText(line, {
            x: 48, y: 404 - i * 27, size: 10, font: normal, color: grey,
        }));
        page.drawText('CarMazium - carmazium.com', {
            x: 48, y: 56, size: 10, font: normal, color: ink,
        });
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
        if (!sale?.buyer) throw new NotFoundException('Purchase not found');

        const buyer = sale.buyer;
        const buyerName = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || buyer.email;
        const sellerName = seller.sellerCompany || seller.sellerName;
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
        const sellerAddress = seller.contactUnlocked ? seller.sellerAddress : null;
        if (sellerAddress) row('Seller address on file', sellerAddress, sellerY - 25);
        const priceY = sellerY - (sellerAddress ? 25 : 0) - 46;
        heading('AGREED VEHICLE PRICE', priceY);
        page.drawRectangle({ x: 48, y: priceY - 63, width: width - 96, height: 48, color: pale });
        page.drawText(money(purchase.purchasePrice), { x: 63, y: priceY - 47, font: bold, size: 21, color: navy });

        const paymentNote = purchase.payment.sellerFundsConfirmedAt
            ? 'Seller funds confirmation recorded: ' + date(purchase.payment.sellerFundsConfirmedAt) + '.'
            : 'CarMazium has not independently verified vehicle payment.';
        page.drawText(oneLine(paymentNote, normal, 9, width - 96), {
            x: 48, y: 187, font: normal, size: 9, color: grey,
        });
        page.drawLine({ start: { x: 48, y: 165 }, end: { x: width - 48, y: 165 }, thickness: 0.8, color: grey });
        const notes = [
            'This document records a sale and the buyer\'s collection confirmation on CarMazium.',
            'Vehicle purchase money is paid directly by the buyer to the seller, not to CarMazium.',
            'This is not a seller-issued invoice, a VAT invoice, or independent proof of payment.',
            'Retain the seller\'s invoice and bank transfer evidence for your accounting records.',
        ];
        notes.forEach((line, i) => page.drawText(line, {
            x: 48, y: 146 - i * 16, font: normal, size: 8.7, color: grey,
        }));
        page.drawText('Issued from CarMazium purchase records · carmazium.com', {
            x: 48, y: 43, font: normal, size: 9, color: grey,
        });
        return Buffer.from(await pdf.save());
    }
}
