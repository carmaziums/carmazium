import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from 'pdf-lib';
import {
    HPI_CHECK_DEFINITIONS,
    HpiReportData,
    deriveIsClear,
} from './hpi-report.types';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

const BRAND = rgb(0.9294, 0.1098, 0.1412); // #ED1C24
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);
const PASS = rgb(0.06, 0.5, 0.32);
const FAIL = rgb(0.75, 0.11, 0.14);
const PANEL = rgb(0.97, 0.975, 0.98);

const FOOTER_ADDRESS = 'CarMazium | 181 - 187 Hunters Road, Birmingham, B19 1ES';

/**
 * Renders the approved CarMazium Vehicle History Report layout.
 *
 * Laid out as a flowing document with automatic page breaks rather than four
 * fixed pages: the mileage, MOT and previous-search tables are variable length,
 * and a vehicle with a long MOT history would otherwise overflow off the page.
 */
@Injectable()
export class HpiPdfService {
    private readonly logger = new Logger(HpiPdfService.name);

    async render(data: HpiReportData): Promise<Buffer> {
        const pdf = await PDFDocument.create();
        const [regular, bold] = await Promise.all([
            pdf.embedFont(StandardFonts.Helvetica),
            pdf.embedFont(StandardFonts.HelveticaBold),
        ]);

        const ctx = new Layout(pdf, regular, bold);

        this.drawCoverBlock(ctx, data);
        this.drawVehicleDetails(ctx, data);
        this.drawCheckSummary(ctx, data);
        this.drawMileageHistory(ctx, data);
        this.drawMotSection(ctx, data);
        this.drawKeeperSection(ctx, data);
        this.drawDisclaimer(ctx, data);

        ctx.paginate();

        const bytes = await pdf.save();
        return Buffer.from(bytes);
    }

    // ── Cover ────────────────────────────────────────────────────────────────

    private drawCoverBlock(ctx: Layout, data: HpiReportData) {
        const v = data.vehicle || {};

        ctx.text('CARMAZIUM', { font: 'bold', size: 20, color: BRAND, letterSpacing: 1.5 });
        ctx.gap(4);
        ctx.text('VEHICLE HISTORY REPORT', { font: 'bold', size: 15, color: INK, letterSpacing: 0.6 });
        ctx.gap(3);
        ctx.text('CarMazium presentation of supplied third-party vehicle-check information', {
            size: 8.5,
            color: MUTED,
        });
        ctx.gap(16);

        const title = [v.make, v.model].filter(Boolean).join(' ').toUpperCase() || 'VEHICLE';
        ctx.text(title, { font: 'bold', size: 17, color: INK });
        ctx.gap(4);

        const specLine = [
            v.vrm ? `Registration: ${v.vrm}` : null,
            v.yearOfManufacture,
            v.fuelType,
            v.transmission,
        ]
            .filter(Boolean)
            .join(' | ');
        if (specLine) ctx.text(specLine, { size: 9.5, color: MUTED });
        ctx.gap(14);

        // Outcome panel
        const isClear = deriveIsClear(data.checks);
        const failed = HPI_CHECK_DEFINITIONS.filter((d) => data.checks?.[d.key]?.passed === false);
        const outcomeTitle = isClear ? 'ALL CHECKS PASSED' : `${failed.length} CHECK${failed.length === 1 ? '' : 'S'} NOT PASSED`;
        const outcomeBody = isClear
            ? 'No adverse history recorded in supplied check'
            : failed.map((f) => f.label.replace(/^Not |^No /, '')).join(', ');

        ctx.panel(56, (page, top) => {
            page.drawText('OUTCOME', {
                x: MARGIN + 14,
                y: top - 16,
                size: 7.5,
                font: ctx.bold,
                color: MUTED,
            });
            page.drawText(outcomeTitle, {
                x: MARGIN + 14,
                y: top - 32,
                size: 12,
                font: ctx.bold,
                color: isClear ? PASS : FAIL,
            });
            page.drawText(ctx.truncate(outcomeBody, CONTENT_WIDTH - 28, 8, ctx.regular), {
                x: MARGIN + 14,
                y: top - 46,
                size: 8,
                font: ctx.regular,
                color: MUTED,
            });
        });

        ctx.gap(14);
        if (data.sourceCheckDate) {
            ctx.text(`Source check date: ${data.sourceCheckDate}`, { size: 8.5, color: MUTED });
            ctx.gap(10);
        }

        ctx.heading('Data source disclosure');
        ctx.paragraph(
            `This CarMazium report presents vehicle-history information from a supplied ${data.sourceName || 'third-party vehicle check'}` +
            `${data.sourceCheckDate ? ` dated ${data.sourceCheckDate}` : ''}. CarMazium did not originate or independently verify the ` +
            `underlying third-party data. The supplied source check remains authoritative.`,
            { size: 8, color: MUTED },
        );
    }

    // ── Vehicle details ──────────────────────────────────────────────────────

    private drawVehicleDetails(ctx: Layout, data: HpiReportData) {
        const v = data.vehicle || {};
        const rows: [string, string | undefined][] = [
            ['Make', v.make],
            ['Model', v.model],
            ['Body type', v.bodyType],
            ['Fuel type', v.fuelType],
            ['Transmission', v.transmission],
            ['Engine capacity', v.engineCapacity],
            ['VRM', v.vrm],
            ['VIN', v.vin],
            ['Engine number', v.engineNumber],
            ['Colour', v.colour],
            ['First registered', v.firstRegistered],
            ['Year of manufacture', v.yearOfManufacture],
            ['Previous owners', v.previousOwners],
            ['Current V5C issue date', v.currentV5cIssueDate],
            ['CO2 emissions', v.co2Emissions],
        ];

        ctx.sectionTitle('Vehicle details');
        for (const [label, value] of rows) {
            if (!value) continue;
            ctx.labelValueRow(label, value);
        }
    }

    // ── Check summary ────────────────────────────────────────────────────────

    private drawCheckSummary(ctx: Layout, data: HpiReportData) {
        ctx.sectionTitle('Vehicle check summary');
        ctx.tableHeader('CHECK', 'RESULT');

        for (const def of HPI_CHECK_DEFINITIONS) {
            const entry = data.checks?.[def.key];
            const passed = entry?.passed !== false;
            const label = entry?.note && !passed ? `${def.label} — ${entry.note}` : def.label;
            ctx.tableRow(label, passed ? 'Passed' : 'Not passed', passed ? PASS : FAIL);
        }

        if (data.motExpiry) {
            ctx.tableRow('MOT expiry', data.motExpiry, INK);
        }
    }

    // ── Mileage ──────────────────────────────────────────────────────────────

    private drawMileageHistory(ctx: Layout, data: HpiReportData) {
        const rows = data.mileageHistory || [];
        if (rows.length === 0) return;

        ctx.sectionTitle('Mileage history');
        ctx.tableHeader3('Date', 'Mileage', 'Source');
        for (const r of rows) {
            ctx.tableRow3(r.date || '—', r.mileage || '—', r.source || '—');
        }

        if (data.vehicle?.currentV5cIssueDate) {
            ctx.gap(10);
            ctx.heading('V5C logbook');
            ctx.labelValueRow('Current V5C issue date', data.vehicle.currentV5cIssueDate);
        }
    }

    // ── MOT ──────────────────────────────────────────────────────────────────

    private drawMotSection(ctx: Layout, data: HpiReportData) {
        const hasAny =
            data.motStatus || data.motExpiry || data.motMileageRecording || data.motCurrentAdvisory || (data.motHistory || []).length;
        if (!hasAny) return;

        ctx.sectionTitle('MOT information');
        if (data.motStatus) ctx.labelValueRow('Status', data.motStatus);
        if (data.motExpiry) ctx.labelValueRow('MOT expiry', data.motExpiry);
        if (data.motMileageRecording) ctx.labelValueRow('Mileage recording', data.motMileageRecording);
        if (data.motCurrentAdvisory) ctx.labelValueRow('Current advisory', data.motCurrentAdvisory);

        const history = data.motHistory || [];
        if (history.length) {
            ctx.gap(8);
            for (const h of history) {
                ctx.tableRow(h.date || '—', h.detail || '—', MUTED);
            }
        }
    }

    // ── Keepers & searches ───────────────────────────────────────────────────

    private drawKeeperSection(ctx: Layout, data: HpiReportData) {
        if (!data.previousKeepers && !data.lastKeeperChange && !(data.previousSearches || []).length) return;

        ctx.sectionTitle('Previous keepers');
        if (data.previousKeepers) ctx.labelValueRow('Number of previous keepers', data.previousKeepers);
        if (data.lastKeeperChange) ctx.labelValueRow('Last keeper change', data.lastKeeperChange);

        const searches = data.previousSearches || [];
        if (searches.length) {
            ctx.gap(10);
            ctx.heading('Previous vehicle-check searches');
            for (const s of searches) {
                ctx.tableRow(s.type || '—', s.date || '—', MUTED);
            }
        }
    }

    private drawDisclaimer(ctx: Layout, data: HpiReportData) {
        ctx.gap(14);
        ctx.paragraph(
            `Important: This document is a CarMazium-branded presentation of the supplied third-party check, not an independently ` +
            `generated HPI or vehicle-history check. Vehicle-history databases can update after a delay. Buyers should verify the ` +
            `vehicle, V5C, MOT history and any information material to the purchase before completing a transaction.`,
            { size: 7.5, color: MUTED },
        );
    }
}

// ── Layout engine ────────────────────────────────────────────────────────────

type TextOpts = {
    font?: 'regular' | 'bold';
    size?: number;
    color?: RGB;
    letterSpacing?: number;
};

/**
 * Minimal flowing-layout helper over pdf-lib, which is otherwise
 * absolute-positioning only. Tracks a y cursor, starts a new page when a block
 * won't fit, and stamps footers once at the end when the page count is known.
 */
class Layout {
    private pages: PDFPage[] = [];
    private page!: PDFPage;
    private y = 0;

    constructor(
        private readonly pdf: PDFDocument,
        public readonly regular: PDFFont,
        public readonly bold: PDFFont,
    ) {
        this.newPage();
    }

    private newPage() {
        this.page = this.pdf.addPage([A4_WIDTH, A4_HEIGHT]);
        this.pages.push(this.page);
        this.y = A4_HEIGHT - MARGIN;
    }

    /** Reserve vertical space, breaking to a new page if it won't fit. */
    private ensure(height: number) {
        if (this.y - height < MARGIN + 28) this.newPage();
    }

    gap(h: number) {
        this.y -= h;
    }

    text(value: string, opts: TextOpts = {}) {
        const size = opts.size ?? 10;
        this.ensure(size + 4);
        const font = opts.font === 'bold' ? this.bold : this.regular;
        this.page.drawText(value, {
            x: MARGIN,
            y: this.y - size,
            size,
            font,
            color: opts.color ?? INK,
            ...(opts.letterSpacing ? { characterSpacing: opts.letterSpacing } : {}),
        });
        this.y -= size + 4;
    }

    sectionTitle(value: string) {
        this.gap(16);
        this.ensure(26);
        this.page.drawText(value, {
            x: MARGIN,
            y: this.y - 11,
            size: 11,
            font: this.bold,
            color: INK,
        });
        this.y -= 16;
        this.page.drawRectangle({
            x: MARGIN,
            y: this.y,
            width: CONTENT_WIDTH,
            height: 1.2,
            color: BRAND,
        });
        this.y -= 10;
    }

    heading(value: string) {
        this.gap(6);
        this.text(value, { font: 'bold', size: 9.5, color: INK });
        this.gap(2);
    }

    paragraph(value: string, opts: TextOpts = {}) {
        const size = opts.size ?? 8.5;
        const font = opts.font === 'bold' ? this.bold : this.regular;
        for (const line of this.wrap(value, CONTENT_WIDTH, size, font)) {
            this.ensure(size + 3);
            this.page.drawText(line, {
                x: MARGIN,
                y: this.y - size,
                size,
                font,
                color: opts.color ?? INK,
            });
            this.y -= size + 3;
        }
    }

    labelValueRow(label: string, value: string) {
        const size = 9;
        this.ensure(size + 9);
        const rowTop = this.y;
        this.page.drawText(label, {
            x: MARGIN,
            y: rowTop - size,
            size,
            font: this.regular,
            color: MUTED,
        });
        const valueX = MARGIN + CONTENT_WIDTH * 0.45;
        this.page.drawText(this.truncate(value, CONTENT_WIDTH * 0.55, size, this.bold), {
            x: valueX,
            y: rowTop - size,
            size,
            font: this.bold,
            color: INK,
        });
        this.y -= size + 6;
        this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT_WIDTH, height: 0.5, color: RULE });
        this.y -= 3;
    }

    tableHeader(left: string, right: string) {
        this.ensure(18);
        this.page.drawText(left, { x: MARGIN, y: this.y - 8, size: 7.5, font: this.bold, color: MUTED });
        this.page.drawText(right, {
            x: MARGIN + CONTENT_WIDTH * 0.72,
            y: this.y - 8,
            size: 7.5,
            font: this.bold,
            color: MUTED,
        });
        this.y -= 14;
        this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT_WIDTH, height: 0.6, color: RULE });
        this.y -= 4;
    }

    tableRow(left: string, right: string, rightColor: RGB = INK) {
        const size = 9;
        this.ensure(size + 9);
        this.page.drawText(this.truncate(left, CONTENT_WIDTH * 0.68, size, this.regular), {
            x: MARGIN,
            y: this.y - size,
            size,
            font: this.regular,
            color: INK,
        });
        this.page.drawText(right, {
            x: MARGIN + CONTENT_WIDTH * 0.72,
            y: this.y - size,
            size,
            font: this.bold,
            color: rightColor,
        });
        this.y -= size + 6;
        this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT_WIDTH, height: 0.5, color: RULE });
        this.y -= 3;
    }

    tableHeader3(a: string, b: string, c: string) {
        this.ensure(18);
        const cols = [MARGIN, MARGIN + CONTENT_WIDTH * 0.4, MARGIN + CONTENT_WIDTH * 0.72];
        [a, b, c].forEach((label, i) => {
            this.page.drawText(label, { x: cols[i], y: this.y - 8, size: 7.5, font: this.bold, color: MUTED });
        });
        this.y -= 14;
        this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT_WIDTH, height: 0.6, color: RULE });
        this.y -= 4;
    }

    tableRow3(a: string, b: string, c: string) {
        const size = 9;
        this.ensure(size + 9);
        const cols = [MARGIN, MARGIN + CONTENT_WIDTH * 0.4, MARGIN + CONTENT_WIDTH * 0.72];
        const fonts = [this.regular, this.bold, this.regular];
        const colors = [INK, INK, MUTED];
        [a, b, c].forEach((value, i) => {
            this.page.drawText(this.truncate(value, CONTENT_WIDTH * 0.28, size, fonts[i]), {
                x: cols[i],
                y: this.y - size,
                size,
                font: fonts[i],
                color: colors[i],
            });
        });
        this.y -= size + 6;
        this.page.drawRectangle({ x: MARGIN, y: this.y, width: CONTENT_WIDTH, height: 0.5, color: RULE });
        this.y -= 3;
    }

    /** Draws a filled panel of fixed height and hands back its top edge. */
    panel(height: number, draw: (page: PDFPage, top: number) => void) {
        this.ensure(height + 6);
        const top = this.y;
        this.page.drawRectangle({
            x: MARGIN,
            y: top - height,
            width: CONTENT_WIDTH,
            height,
            color: PANEL,
        });
        this.page.drawRectangle({
            x: MARGIN,
            y: top - height,
            width: 3,
            height,
            color: BRAND,
        });
        draw(this.page, top);
        this.y -= height;
    }

    /** Footers need the final page count, so they're stamped after layout. */
    paginate() {
        const total = this.pages.length;
        this.pages.forEach((page, i) => {
            page.drawText(FOOTER_ADDRESS, {
                x: MARGIN,
                y: MARGIN - 18,
                size: 7,
                font: this.regular,
                color: MUTED,
            });
            const label = `Page ${i + 1} of ${total}`;
            const width = this.regular.widthOfTextAtSize(label, 7);
            page.drawText(label, {
                x: A4_WIDTH - MARGIN - width,
                y: MARGIN - 18,
                size: 7,
                font: this.regular,
                color: MUTED,
            });
        });
    }

    truncate(value: string, maxWidth: number, size: number, font: PDFFont): string {
        const clean = this.sanitize(value);
        if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
        let out = clean;
        while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
            out = out.slice(0, -1);
        }
        return `${out}…`;
    }

    private wrap(value: string, maxWidth: number, size: number, font: PDFFont): string[] {
        const words = this.sanitize(value).split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    /**
     * StandardFonts are WinAnsi-encoded and throw on characters outside it —
     * a smart quote or em dash pasted in from a source report would otherwise
     * fail the whole render.
     */
    private sanitize(value: string): string {
        return String(value ?? '')
            .replace(/[‘’]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/[–—]/g, '-')
            .replace(/…/g, '...')
            // eslint-disable-next-line no-control-regex
            .replace(/[^\x00-\xFF]/g, '');
    }
}
