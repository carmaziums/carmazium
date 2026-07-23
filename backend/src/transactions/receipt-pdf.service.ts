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
// Derived by parsing the letterhead's own (Flate-decoded) content stream —
// not estimated from a screenshot — so these line up with the template's
// actual text/rectangle boxes. The page applies a top-down flip
// (`1 0 0 -1 0 1526 cm`) internally; every number below is already converted
// back to standard bottom-up PDF space. If a value ever drifts, re-derive by
// decoding the content stream rather than eyeballing a render.
const LAYOUT = {
    pageWidth: 1080,
    pageHeight: 1526,

    // Values on the "Invoice #" / "Creation date" / "Due date" column (right side of header)
    invoiceValueX: 904,
    invoiceValueY: 1212,
    creationDateValueX: 887,
    creationDateValueY: 1178,
    dueDateValueX: 887,
    dueDateValueY: 1144,

    // Bill-to block (left side of header) — template has no pre-printed sample
    // here, so these just need to sit below the "BILL TO" heading (box ends
    // at y≈1203) and above the table (starts at y≈1047). Aligned to the same
    // rows as creation/due date for a clean two-column header.
    billToX: 72,
    billToNameY: 1178,
    billToLineHeight: 22,
    billToStartY: 1144,

    // Table body — single line item drawn at this row; multi-line items stack downward.
    // Empty row spans y 1047–979 (top-down 479–547); baseline picked near its vertical center.
    tableRowStartY: 1007,
    tableRowHeight: 26,
    tableColDescriptionX: 84,
    tableColQtyX: 545,
    tableColPriceX: 705,
    tableColAmountX: 900,

    // Total value — right-edge of the amount cell inside the TOTAL band (x=997),
    // right-aligned by subtracting the rendered text's width from this X.
    totalValueX: 997,
    totalValueY: 935,

    // Cover rectangles over the letterhead's pre-printed sample values, sized
    // generously so a longer real value (e.g. a 9-digit invoice number) can't
    // peek out from under the old sample text.
    coverBoxes: [
        // INV00001 sample value — white background
        { x: 895, y: 1200, w: 130, h: 40, fill: 'white' as const },
        // 22/07/2026 sample creation date — white background
        { x: 878, y: 1166, w: 140, h: 40, fill: 'white' as const },
        // 29/07/2026 sample due date — white background
        { x: 878, y: 1132, w: 140, h: 40, fill: 'white' as const },
        // £0.00 sample total — sits on the navy TOTAL band, must be covered
        // with the band's own colour (not white) or the patch shows as a seam.
        { x: 840, y: 916, w: 178, h: 62, fill: 'brand' as const },
    ],
};

// Exact brand colour parsed from the letterhead's own content stream
// (".2549 .251 .5922 rg") — used for the table header bar, the TOTAL band,
// and the column divider lines. Must match exactly or the TOTAL cover patch
// shows a visible border against the surrounding band.
const BRAND = rgb(0.2549, 0.251, 0.5922);
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
        // Header fields sit on the white paper (cover white); the TOTAL band
        // is filled with the letterhead's own brand colour (cover brand, then
        // draw white text on top) so the patch is invisible against the band.
        for (const box of LAYOUT.coverBoxes) {
            const color = box.fill === 'brand' ? BRAND : WHITE;
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
