import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HpiPdfService } from './hpi-pdf.service';
import {
    HPI_CHECK_KEYS,
    HpiReportData,
    defaultChecks,
    deriveIsClear,
} from './hpi-report.types';

/**
 * HPI reports are prepared by CarMazium staff, not fetched from an API.
 *
 * A seller opting in at listing time creates a PENDING row the moment their
 * payment clears; an admin then fills in the check results from the supplied
 * third-party check, which computes `isClear` and flips the row to COMPLETED.
 * A listing cannot be approved while its report is still PENDING (enforced in
 * AdminService.approveListing).
 *
 * Rows created before this change came from OneAutoAPI and carry
 * source=ONE_AUTO_API with the raw response in `data` — they still render
 * through parseLegacySummary so nothing a seller already paid for breaks.
 */
@Injectable()
export class HpiService {
    private readonly logger = new Logger(HpiService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly hpiPdfService: HpiPdfService,
    ) { }

    /**
     * Called when an HPI payment clears. Idempotent: Stripe can deliver the
     * webhook more than once, and the checkout-success page calls the same
     * fallback path, so this must never create a second row or clobber a
     * report an admin has already filled in.
     */
    async createPendingReport(listingId: string, vrm: string, transactionId?: string) {
        const existing = await this.prisma.hpiReport.findUnique({ where: { listingId } });
        if (existing) {
            this.logger.log(`HPI report already exists for listing ${listingId} — leaving as-is`);
            return existing;
        }

        const report = await this.prisma.hpiReport.create({
            data: {
                listingId,
                vrm,
                transactionId,
                status: 'PENDING',
                source: 'ADMIN',
                isClear: false,
            },
        });

        this.logger.log(`HPI report requested for listing ${listingId} (VRM ${vrm}) — awaiting admin`);
        return report;
    }

    async getReportForListing(listingId: string) {
        const report = await this.prisma.hpiReport.findUnique({ where: { listingId } });
        if (!report) {
            throw new NotFoundException('HPI Report not found for this listing');
        }
        return report;
    }

    /** Listings whose seller has paid but whose report hasn't been produced yet. */
    async getPendingReports() {
        return this.prisma.hpiReport.findMany({
            where: { status: 'PENDING' },
            orderBy: { purchasedAt: 'asc' },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        status: true,
                        type: true,
                        vrm: true,
                        make: true,
                        model: true,
                        year: true,
                        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                    },
                },
            },
        });
    }

    /**
     * Seeds the admin form from what the listing already knows (mostly DVLA
     * data captured during the wizard), so the admin only types what's unique
     * to the third-party check rather than re-keying the whole vehicle.
     */
    async buildPrefill(listingId: string): Promise<HpiReportData> {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                vrm: true, make: true, model: true, year: true, color: true,
                fuelType: true, transmission: true, bodyType: true, engineSize: true,
                vin: true, co2Emissions: true, owners: true, mileage: true,
                motExpiryDate: true, monthOfFirstRegistration: true,
            },
        });

        if (!listing) throw new NotFoundException('Listing not found');

        const existing = await this.prisma.hpiReport.findUnique({ where: { listingId } });
        // Re-editing a completed report should reopen exactly what was saved,
        // not silently reset the admin's work back to listing defaults.
        if (existing?.reportData) {
            return existing.reportData as unknown as HpiReportData;
        }

        // motExpiryDate is stored as an ISO string and monthOfFirstRegistration
        // as "YYYY-MM", so both arrive as strings rather than Dates.
        const fmtDate = (d: Date | string | null | undefined) => {
            if (!d) return '';
            const parsed = new Date(d);
            return Number.isNaN(parsed.getTime())
                ? String(d)
                : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        };

        return {
            sourceName: 'AutoTrader Vehicle Check',
            sourceCheckDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            vehicle: {
                make: listing.make ?? '',
                model: listing.model ?? '',
                bodyType: listing.bodyType ?? '',
                fuelType: listing.fuelType ?? '',
                transmission: listing.transmission ?? '',
                engineCapacity: listing.engineSize ? `${listing.engineSize} cc` : '',
                vrm: listing.vrm ?? '',
                vin: listing.vin ?? '',
                engineNumber: '',
                colour: listing.color ?? '',
                firstRegistered: fmtDate(listing.monthOfFirstRegistration),
                yearOfManufacture: listing.year ? String(listing.year) : '',
                previousOwners: listing.owners != null ? String(listing.owners) : '',
                currentV5cIssueDate: '',
                co2Emissions: listing.co2Emissions ? `${listing.co2Emissions} g/km` : '',
            },
            checks: defaultChecks(),
            motStatus: '',
            motExpiry: fmtDate(listing.motExpiryDate),
            motMileageRecording: listing.mileage != null ? `${Number(listing.mileage).toLocaleString('en-GB')} miles` : '',
            motCurrentAdvisory: '',
            motHistory: [],
            mileageHistory: [],
            previousKeepers: listing.owners != null ? String(listing.owners) : '',
            lastKeeperChange: '',
            previousSearches: [],
        };
    }

    /**
     * Saves an admin-prepared report and marks it COMPLETED.
     * `isClear` is derived from the checks rather than accepted from the
     * client, so the badge shown on listings can never disagree with the
     * checks printed on the PDF.
     */
    async saveAdminReport(listingId: string, data: HpiReportData, adminId: string) {
        const report = await this.prisma.hpiReport.findUnique({ where: { listingId } });
        if (!report) {
            throw new NotFoundException('No HPI report was requested for this listing');
        }

        this.validate(data);

        const normalised: HpiReportData = {
            ...data,
            checks: HPI_CHECK_KEYS.reduce(
                (acc, key) => {
                    const entry = data.checks?.[key];
                    acc[key] = { passed: entry?.passed !== false, ...(entry?.note ? { note: entry.note } : {}) };
                    return acc;
                },
                {} as HpiReportData['checks'],
            ),
            motHistory: data.motHistory ?? [],
            mileageHistory: data.mileageHistory ?? [],
            previousSearches: data.previousSearches ?? [],
        };

        const updated = await this.prisma.hpiReport.update({
            where: { listingId },
            data: {
                reportData: normalised as unknown as object,
                isClear: deriveIsClear(normalised.checks),
                status: 'COMPLETED',
                source: 'ADMIN',
                preparedById: adminId,
                preparedAt: new Date(),
                ...(normalised.vehicle?.vrm ? { vrm: normalised.vehicle.vrm } : {}),
            },
        });

        this.logger.log(`HPI report completed for listing ${listingId} by admin ${adminId}`);
        return updated;
    }

    private validate(data: HpiReportData) {
        if (!data) throw new BadRequestException('Report data is required');
        if (!data.sourceName?.trim()) {
            throw new BadRequestException('Source name is required — the report must disclose where the check came from');
        }
        if (!data.sourceCheckDate?.trim()) {
            throw new BadRequestException('Source check date is required');
        }
        if (!data.vehicle?.vrm?.trim()) {
            throw new BadRequestException('Vehicle registration (VRM) is required');
        }
    }

    /** Renders the branded PDF on demand. Never stored — see HpiController. */
    async renderPdf(listingId: string): Promise<{ buffer: Buffer; filename: string }> {
        const report = await this.getReportForListing(listingId);

        if (report.status !== 'COMPLETED' || !report.reportData) {
            throw new BadRequestException('This HPI report has not been prepared yet');
        }

        const data = report.reportData as unknown as HpiReportData;
        const buffer = await this.hpiPdfService.render(data);
        const vrm = (data.vehicle?.vrm || report.vrm || 'vehicle').replace(/[^A-Za-z0-9]/g, '');
        return { buffer, filename: `CarMazium_Vehicle_History_Report_${vrm}.pdf` };
    }

    /**
     * Legacy OneAutoAPI reports only. New admin-prepared reports are returned
     * as their structured `reportData` instead — see HpiController.getSummary.
     */
    parseLegacySummary(rawData: any): HpiReportSummary {
        const items = rawData?.Response?.DataItems || rawData?.result || rawData || {};

        const vehicleReg = items?.VehicleRegistration || {};
        const vehicleStatus = items?.VehicleStatus || {};
        const stolenDetails = items?.StolenDetails || {};
        const financeDetails = items?.FinanceDetails || {};
        const writeOffDetails = items?.WriteOffDetails || {};
        const plateChangeDetails = items?.PlateChangeDetails || {};
        const mileageDetails = items?.MileageDetails || {};
        const technicalDetails = items?.TechnicalDetails || {};

        return {
            vrm: vehicleReg.Vrm || items.vrm || '',
            make: vehicleReg.Make || items.make || '',
            model: vehicleReg.Model || items.model || '',
            colour: vehicleReg.Colour || items.colour || '',
            yearOfManufacture: vehicleReg.YearOfManufacture || items.yearOfManufacture || '',
            registrationDate: vehicleReg.DateFirstRegistered || items.registrationDate || '',
            engineSize: technicalDetails?.SmmtDetails?.EngineCapacity || vehicleReg.EngineSize || items.engineSize || '',
            fuelType: vehicleReg.FuelType || items.fuelType || '',
            checks: {
                stolen: {
                    passed: !(stolenDetails?.IsStolen === true),
                    detail: stolenDetails?.IsStolen === true ? 'Vehicle reported as stolen' : 'No record of being reported stolen',
                },
                writeOff: {
                    passed: !(writeOffDetails?.IsWrittenOff === true),
                    detail: writeOffDetails?.IsWrittenOff === true
                        ? `Written off: Category ${writeOffDetails?.Category || 'Unknown'}`
                        : 'No insurance write-off recorded',
                    category: writeOffDetails?.Category || null,
                },
                scrapped: {
                    passed: !(vehicleStatus?.IsScrapped === true),
                    detail: vehicleStatus?.IsScrapped === true ? 'Vehicle recorded as scrapped' : 'Not recorded as scrapped',
                },
                financeOutstanding: {
                    passed: !(financeDetails?.IsOnFinance === true),
                    detail: financeDetails?.IsOnFinance === true
                        ? `Outstanding finance of £${financeDetails?.AgreementAmount || 'unknown'}`
                        : 'No outstanding finance detected',
                    agreementId: financeDetails?.AgreementId || null,
                },
                plateChange: {
                    passed: !(plateChangeDetails?.HasPlateChange === true),
                    detail: plateChangeDetails?.HasPlateChange === true
                        ? `${plateChangeDetails?.NumberOfPlateChanges || 1} plate change(s) recorded`
                        : 'No plate changes recorded',
                },
                mileageAnomaly: {
                    passed: !(mileageDetails?.HasMileageAnomaly === true),
                    detail: mileageDetails?.HasMileageAnomaly === true
                        ? 'Possible mileage discrepancy detected'
                        : 'Mileage appears consistent',
                },
            },
        };
    }
}

export interface HpiCheckResult {
    passed: boolean;
    detail: string;
    category?: string | null;
    agreementId?: string | null;
}

export interface HpiReportSummary {
    vrm: string;
    make: string;
    model: string;
    colour: string;
    yearOfManufacture: string;
    registrationDate: string;
    engineSize: string;
    fuelType: string;
    checks: {
        stolen: HpiCheckResult;
        writeOff: HpiCheckResult;
        scrapped: HpiCheckResult;
        financeOutstanding: HpiCheckResult;
        plateChange: HpiCheckResult;
        mileageAnomaly: HpiCheckResult;
    };
}
