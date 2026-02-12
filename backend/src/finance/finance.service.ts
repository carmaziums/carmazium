import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceApplicationDto } from './dto/create-finance-application.dto';
import { UpdateFinanceStatusDto } from './dto/update-finance-status.dto';

@Injectable()
export class FinanceService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateFinanceApplicationDto) {
        return this.prisma.financeApplication.create({
            data: {
                userId,
                listingId: dto.listingId,
                partnerId: dto.partnerId,
                depositAmount: dto.depositAmount,
                termMonths: dto.termMonths,
            },
        });
    }

    async findMyApplications(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.financeApplication.findMany({
                where: { userId, deletedAt: null },
                include: {
                    partner: true,
                    listing: { select: { title: true, make: true, model: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.financeApplication.count({ where: { userId, deletedAt: null } }),
        ]);
        return { data, total };
    }

    async findByPartner(partnerId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.financeApplication.findMany({
                where: { partnerId, deletedAt: null },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                    listing: { select: { title: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.financeApplication.count({ where: { partnerId, deletedAt: null } }),
        ]);
        return { data, total };
    }

    async updateStatus(applicationId: string, partnerProfileId: string, dto: UpdateFinanceStatusDto) {
        const app = await this.prisma.financeApplication.findUnique({
            where: { id: applicationId },
        });

        if (!app || app.deletedAt) {
            throw new NotFoundException('Application not found');
        }

        if (app.partnerId !== partnerProfileId) {
            throw new ForbiddenException('You do not have permission to update this application');
        }

        const updateData: any = { status: dto.status };
        if (dto.status === 'APPROVED' && dto.monthlyPayment) {
            updateData.monthlyPayment = dto.monthlyPayment;
            updateData.approvalDate = new Date();
        }

        return this.prisma.financeApplication.update({
            where: { id: applicationId },
            data: updateData,
        });
    }

    async getPartnerProfileId(userId: string): Promise<string | null> {
        const profile = await this.prisma.partnerProfile.findFirst({
            where: { financeUserId: userId, partnerType: 'FINANCE_PARTNER' },
        });
        return profile?.id || null;
    }
}
