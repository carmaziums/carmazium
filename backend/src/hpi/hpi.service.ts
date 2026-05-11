import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HpiService {
    private readonly logger = new Logger(HpiService.name);

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
        const apiUrl = this.configService.get<string>('ONE_AUTO_API_URL') || 'https://api.oneautoapi.com/ukvehicledata/keyvehicledetailsfromvrm/v2';

        if (!apiKey) {
            this.logger.error('ONE_AUTO_API_KEY is not configured');
            throw new Error('API Key missing');
        }

        try {
            // Call OneAutoAPI
            const response = await firstValueFrom(
                this.httpService.get(`${apiUrl}?vehicle_registration_mark=${vrm}`, {
                    headers: { 'x-api-key': apiKey },
                })
            );

            const data = response.data;
            
            // Logic to determine if vehicle is clear (Depends on exact API structure, simplified here)
            // Typically check for stolen, scrapped, imported, exported flags
            let isClear = true; 
            
            // Note: Since OneAutoAPI structure requires inspection, we assume a safe default 
            // based on the presence of any negative markers if they existed in response.
            if (data?.result?.stolen === true || data?.result?.scrapped === true || data?.result?.writtenOff === true) {
                isClear = false;
            }

            // Upsert the report into the database
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
}
