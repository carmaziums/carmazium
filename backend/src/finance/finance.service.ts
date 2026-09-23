import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceApplicationDto } from './dto/create-finance-application.dto';
import { UpdateFinanceStatusDto } from './dto/update-finance-status.dto';
import { UserRole } from '@prisma/client';
import {
    assertDealerPermission,
    resolveDealerActor,
} from '../dealers/dealer-access';

@Injectable()
export class FinanceService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Retail buyers own finance applications personally. Dealer users act for
     * one verified dealership, so their applications and history use the
     * DealerProfile owner user as the canonical applicant identity.
     */
    private async resolveFinanceApplicantId(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (user?.role !== UserRole.DEALER) return userId;

        const actor = await resolveDealerActor(this.prisma, userId);
        if (!actor?.isVerified) {
            throw new ForbiddenException(
                'Your dealership must complete KYC before using business finance.',
            );
        }
        assertDealerPermission(
            actor,
            'MANAGE_FINANCE',
            'Your dealership role does not allow finance management.',
        );
        return actor.ownerUserId;
    }

    async create(userId: string, dto: CreateFinanceApplicationDto) {
        const applicantId = await this.resolveFinanceApplicantId(userId);
        return this.prisma.financeApplication.create({
            data: {
                userId: applicantId,
                listingId: dto.listingId,
                partnerId: dto.partnerId,
                depositAmount: dto.depositAmount,
                termMonths: dto.termMonths,
            },
        });
    }

    async findMyApplications(userId: string, page = 1, limit = 20) {
        const applicantId = await this.resolveFinanceApplicantId(userId);
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.financeApplication.findMany({
                where: { userId: applicantId, deletedAt: null },
                include: {
                    partner: true,
                    listing: { select: { title: true, make: true, model: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.financeApplication.count({ where: { userId: applicantId, deletedAt: null } }),
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
