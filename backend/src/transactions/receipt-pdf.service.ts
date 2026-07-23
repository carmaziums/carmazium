import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

type ReceiptData = {
    id: string;
    invoiceNumber: string;
    creationDate: Date;
    dueDate: Date;
    billTo: {
        name: string;
        addressLines: string[];
    };
    lineItems: {
        description: string;
        qty: number;
        unitPrice: number;
        amount: number;
    }[];
    totalAmount: number;
    currency: string;
};

// Positions are given in PDF space (origin bottom-left, page size 1080 x 1526).
// They map visually onto the letterhead's pre-printed labels & rows. If any
// value drifts on top of a letterhead element, nudge the coordinate here.
const LAYOUT = {
    pageWidth: 1080,
    pageHeight: 1526,

    // Values on the "Invoice #" / "Creation date" / "Due date" column (right side of header)
    invoiceValueX: 935,
    invoiceValueY: 1298,
    creationDateValueX: 935,
    creationDateValueY: 1268,
    dueDateValueX: 935,
    dueDateValueY: 1238,

    // Bill-to block (left side of header)
    billToX: 95,
    billToNameY: 1268,
    billToLineHeight: 22,
    billToStartY: 1238,

    // Table body — single line item drawn at this row; multi-line items stack downward.
    // The empty row sits directly below the DESCRIPTION/QTY/PRICE/AMOUNT header band.
    tableRowStartY: 1005,
    tableRowHeight: 26,
    tableColDescriptionX: 95,
    tableColQtyX: 545,
    tableColPriceX: 705,
    tableColAmountX: 900,

    // Total value (baseline inside the TOTAL band at the bottom of the invoice grid)
    totalValueX: 1020,
    totalValueY: 940,

    // White cover-rectangles over the letterhead's pre-printed sample values
    // (they need to be blanked before we overlay our own text).
    coverBoxes: [
        // INV00001 sample value
        { x: 900, y: 1290, w: 170, h: 30 },
        // 22/07/2026 sample creation date
        { x: 900, y: 1260, w: 170, h: 28 },
        // 29/07/2026 sample due date
        { x: 900, y: 1230, w: 170, h: 28 },
        // £0.00 sample total (right-hand side of the TOTAL band)
        { x: 890, y: 928, w: 190, h: 40 },
    ],
};

const NAVY = rgb(0.18, 0.19, 0.44);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

@Injectable()
export class ReceiptPdfService {
    private readonly logger = new Logger(ReceiptPdfService.name);
    private cachedTemplate: Uint8Array | null = null;
    // Both `nest start` (from backend/) and the compiled Docker image
    // (working dir /app, __dirname = /app/dist/transactions) resolve to
    // "<backend>/assets/carmazium-letterhead.pdf" via one of these paths.
    private readonly candidateTemplatePaths = [
        path.resolve(process.cwd(), 'assets', 'carmazium-letterhead.pdf'),
        path.resolve(__dirname, '..', '..', 'assets', 'carmazium-letterhead.pdf'),
        path.resolve(__dirname, '..', '..', '..', 'assets', 'carmazium-letterhead.pdf'),
    ];

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Produces a PDF Buffer overlaying transaction data on the Carmazium letterhead.
     * Callers pass the transactionId + the requesting user's id; the method
     * checks ownership and 404s otherwise.
     */
    async renderForTransaction(transactionId: string, requesterId: string): Promise<Buffer> {
        const txn = await this.prisma.transaction.findFirst({
            where: {
                id: transactionId,
                deletedAt: null,
                OR: [
                    { userId: requesterId }, // the buyer/payer
                    { listing: { sellerId: requesterId } }, // the seller for their side
                ],
            },
            include: {
                listing: {
                    select: { title: true, make: true, model: true, year: true, vrm: true },
                },
                user: {
                    select: { firstName: true, lastName: true, email: true },
                },
            },
        });

        if (!txn) throw new NotFoundException('Transaction not found');

        const buyerName = [txn.user?.firstName, txn.user?.lastName].filter(Boolean).join(' ') || txn.user?.email || 'Customer';
        const vehicleLabel = [
            txn.listing?.year,
            txn.listing?.make,
            txn.listing?.model,
        ].filter(Boolean).join(' ') || txn.listing?.title || 'Vehicle';

        const description = this.buildDescription(txn.type, vehicleLabel, txn.description, txn.stripePaymentId, txn.listing?.vrm);

        const data: ReceiptData = {
            id: txn.id,
            invoiceNumber: this.formatInvoiceNumber(txn),
            creationDate: txn.createdAt,
            // "Due" is display-only for a paid receipt — same as creation date.
            dueDate: txn.createdAt,
            billTo: {
                name: buyerName,
                addressLines: [txn.user?.email || ''].filter(Boolean),
            },
            lineItems: [
                {
                    description,
                    qty: 1,
                    unitPrice: Number(txn.amount),
                    amount: Number(txn.amount),
                },
            ],
            totalAmount: Number(txn.amount),
            currency: 'GBP',
        };

        return this.renderPdf(data);
    }

    private formatInvoiceNumber(txn: { id: string; createdAt: Date }): string {
        // Deterministic short invoice number: INV + 6-digit hash of the id.
        // The letterhead's design shows values like "INV00001" — mimic that shape.
        let hash = 0;
        for (const c of txn.id) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
        return `INV${String(Math.abs(hash) % 900000 + 100000)}`;
    }

    private buildDescription(
        type: string,
        vehicleLabel: string,
        rawDescription: string | null,
        stripePaymentId: string | null,
        vrm: string | null,
    ): string {
        const typeLabels: Record<string, string> = {
            DEPOSIT: 'Deposit — ',
            FULL_PAYMENT: 'Full payment — ',
            COMMISSION: 'Commission — ',
            REFUND: 'Refund — ',
            HPI_REPORT: 'HPI report — ',
            LISTING_FEE: 'Listing fee — ',
            BOOST: 'Featured boost — ',
        };
        const prefix = typeLabels[type] ?? '';
        const desc = rawDescription || `${prefix}${vehicleLabel}${vrm ? ` (${vrm})` : ''}`;
        const ref = stripePaymentId ? `  ·  ref ${stripePaymentId.slice(-10)}` : '';
        return `${desc}${ref}`;
    }

    private async loadTemplate(): Promise<Uint8Array> {
        if (this.cachedTemplate) return this.cachedTemplate;
        for (const p of this.candidateTemplatePaths) {
            try {
                const buf = await fs.readFile(p);
                this.cachedTemplate = new Uint8Array(buf);
                return this.cachedTemplate;
            } catch { /* try next */ }
        }
        this.logger.error(`Letterhead template not found in any of: ${this.candidateTemplatePaths.join(', ')}`);
        throw new Error('Receipt letterhead template missing');
    }

    private async renderPdf(data: ReceiptData): Promise<Buffer> {
        const templateBytes = await this.loadTemplate();
        const pdf = await PDFDocument.load(templateBytes);
        const page = pdf.getPage(0);
        const [helvetica, helveticaBold] = await Promise.all([
            pdf.embedFont(StandardFonts.Helvetica),
            pdf.embedFont(StandardFonts.HelveticaBold),
        ]);

        // Blank out the letterhead's sample data (INV00001, dates, £0.00) so
        // our real values sit on a clean background rather than doubling up.
        // Header fields sit on the white paper (cover in white); the TOTAL band
        // is navy with white text (cover in navy, then draw white on top).
        const covers = LAYOUT.coverBoxes;
        for (let i = 0; i < covers.length; i++) {
            const box = covers[i];
            const color = i === covers.length - 1 ? NAVY : WHITE; // last box = TOTAL band cover
            page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color });
        }

        // ── Header values ────────────────────────────────────────────────────
        page.drawText(data.invoiceNumber, {
            x: LAYOUT.invoiceValueX, y: LAYOUT.invoiceValueY, size: 20, font: helveticaBold, color: BLACK,
        });
        page.drawText(this.formatDate(data.creationDate), {
            x: LAYOUT.creationDateValueX, y: LAYOUT.creationDateValueY, size: 18, font: helvetica, color: BLACK,
        });
        page.drawText(this.formatDate(data.dueDate), {
            x: LAYOUT.dueDateValueX, y: LAYOUT.dueDateValueY, size: 18, font: helvetica, color: BLACK,
        });

        // ── Bill-to block ────────────────────────────────────────────────────
        page.drawText(data.billTo.name, {
            x: LAYOUT.billToX, y: LAYOUT.billToNameY, size: 18, font: helveticaBold, color: BLACK,
        });
        data.billTo.addressLines.forEach((line, i) => {
            page.drawText(line, {
                x: LAYOUT.billToX,
                y: LAYOUT.billToStartY - i * LAYOUT.billToLineHeight,
                size: 15,
                font: helvetica,
                color: BLACK,
            });
        });

        // ── Table rows ───────────────────────────────────────────────────────
        data.lineItems.forEach((item, i) => {
            const y = LAYOUT.tableRowStartY - i * LAYOUT.tableRowHeight;
            page.drawText(this.truncate(item.description, 60), {
                x: LAYOUT.tableColDescriptionX, y, size: 14, font: helvetica, color: BLACK,
            });
            page.drawText(String(item.qty), {
                x: LAYOUT.tableColQtyX, y, size: 14, font: helvetica, color: BLACK,
            });
            page.drawText(this.formatMoney(item.unitPrice, data.currency), {
                x: LAYOUT.tableColPriceX, y, size: 14, font: helvetica, color: BLACK,
            });
            page.drawText(this.formatMoney(item.amount, data.currency), {
                x: LAYOUT.tableColAmountX, y, size: 14, font: helvetica, color: BLACK,
            });
        });

        // ── Total ────────────────────────────────────────────────────────────
        // The letterhead's TOTAL band is a solid navy bar with white text — mirror that.
        const totalLabel = this.formatMoney(data.totalAmount, data.currency);
        const totalWidth = helveticaBold.widthOfTextAtSize(totalLabel, 22);
        page.drawText(totalLabel, {
            x: LAYOUT.totalValueX - totalWidth,
            y: LAYOUT.totalValueY,
            size: 22,
            font: helveticaBold,
            color: WHITE,
        });

        const pdfBytes = await pdf.save();
        return Buffer.from(pdfBytes);
    }

    private formatDate(d: Date): string {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    private formatMoney(amount: number, currency: string): string {
        const symbol = currency === 'GBP' ? '£' : currency + ' ';
        return `${symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    private truncate(s: string, n: number): string {
        if (s.length <= n) return s;
        return s.slice(0, n - 1) + '…';
    }
}
