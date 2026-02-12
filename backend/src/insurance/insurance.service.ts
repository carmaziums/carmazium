import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsuranceQuoteDto } from './dto/create-insurance-quote.dto';
import { UpdateInsuranceStatusDto } from './dto/update-insurance-status.dto';

@Injectable()
export class InsuranceService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateInsuranceQuoteDto) {
        return this.prisma.insuranceQuote.create({
            data: {
                userId,
                listingId: dto.listingId,
                partnerId: dto.partnerId,
                driverAge: dto.driverAge,
                ncbYears: dto.ncbYears,
                hasConvictions: dto.hasConvictions,
            },
        });
    }

    async findMyQuotes(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.insuranceQuote.findMany({
                where: { userId, deletedAt: null },
                include: {
                    partner: true,
                    listing: { select: { title: true, make: true, model: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.insuranceQuote.count({ where: { userId, deletedAt: null } }),
        ]);
        return { data, total };
    }

    async findByPartner(partnerId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.insuranceQuote.findMany({
                where: { partnerId, deletedAt: null },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                    listing: { select: { title: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.insuranceQuote.count({ where: { partnerId, deletedAt: null } }),
        ]);
        return { data, total };
    }

    async updateStatus(quoteId: string, partnerProfileId: string, dto: UpdateInsuranceStatusDto) {
        const quote = await this.prisma.insuranceQuote.findUnique({
            where: { id: quoteId },
        });

        if (!quote || quote.deletedAt) {
            throw new NotFoundException('Quote not found');
        }

        if (quote.partnerId !== partnerProfileId) {
            throw new ForbiddenException('You do not have permission to update this quote');
        }

        const updateData: any = { status: dto.status };
        if (dto.status === 'QUOTED' && dto.annualPrice) {
            updateData.annualPrice = dto.annualPrice;
            updateData.quotedDate = new Date();
        }

        return this.prisma.insuranceQuote.update({
            where: { id: quoteId },
            data: updateData,
        });
    }

    async getPartnerProfileId(userId: string): Promise<string | null> {
        const profile = await this.prisma.partnerProfile.findFirst({
            where: { financeUserId: userId, partnerType: 'INSURANCE_PARTNER' },
        });
        return profile?.id || null;
    }
}
