import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HpiService {
    private readonly logger = new Logger(HpiService.name);
    private readonly API_URL = 'https://api.oneautoapi.com/ukvehicledata/vehicledetailsfromvrm/v2';

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Fetch HPI report from OneAutoAPI and save it to the database
     */
    async generateAndSaveReport(listingId: string, vrm: string, transactionId?: string) {
        const apiKey = this.configService.get<string>('ONE_AUTO_API_KEY');

        if (!apiKey) {
            this.logger.error('ONE_AUTO_API_KEY is not configured');
            throw new Error('HPI API key not configured');
        }

        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.API_URL}?vehicle_registration_mark=${vrm}`, {
                    headers: { 'x-api-key': apiKey },
                })
            );

            const data = response.data;

            // Parse OneAutoAPI response structure to determine if vehicle is clear
            // vehicledetailsfromvrm/v2 returns structured vehicle data
            let isClear = true;
            const result = data?.Response?.DataItems || data?.result || data;

            // Check for negative markers in the response
            const stolen = result?.StolenDetails?.IsStolen === true || result?.stolen === true;
            const scrapped = result?.VehicleStatus?.IsScrapped === true || result?.scrapped === true;
            const writtenOff = result?.WriteOffDetails?.IsWrittenOff === true || result?.writtenOff === true;
            const financeOutstanding = result?.FinanceDetails?.IsOnFinance === true;

            if (stolen || scrapped || writtenOff) {
                isClear = false;
            }

            const report = await this.prisma.hpiReport.upsert({
                where: { listingId },
                update: {
                    vrm,
                    data,
                    isClear,
                    transactionId,
                    purchasedAt: new Date(),
                },
                create: {
                    listingId,
                    vrm,
                    data,
                    isClear,
                    transactionId,
                },
            });

            this.logger.log(`Generated HPI Report for VRM: ${vrm} on Listing: ${listingId}`);
            return report;
        } catch (error: any) {
            this.logger.error(`Failed to fetch HPI report for ${vrm}: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to generate HPI report. Please try again or contact support.');
        }
    }

    /**
     * Fetch an existing HPI report from the DB
     */
    async getReportForListing(listingId: string) {
        const report = await this.prisma.hpiReport.findUnique({
            where: { listingId },
        });

        if (!report) {
            throw new NotFoundException('HPI Report not found for this listing');
        }

        return report;
    }

    /**
     * Parse the raw OneAutoAPI response into a clean, structured summary for display
     */
    parseReportSummary(rawData: any): HpiReportSummary {
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
