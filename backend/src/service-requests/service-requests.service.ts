import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceStatus } from '@prisma/client';

@Injectable()
export class ServiceRequestsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get all service requests for a contractor
     */
    async findByContractor(contractorProfileId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.serviceRequest.findMany({
                where: {
                    contractorId: contractorProfileId,
                    deletedAt: null,
                },
                include: {
                    requester: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.serviceRequest.count({
                where: { contractorId: contractorProfileId, deletedAt: null },
            }),
        ]);

        return { data, total };
    }

    /**
     * Get contractor dashboard stats
     */
    async getContractorStats(contractorProfileId: string) {
        const baseWhere = { contractorId: contractorProfileId, deletedAt: null };

        const [pending, inProgress, completed, totalEarnings] = await Promise.all([
            this.prisma.serviceRequest.count({
                where: { ...baseWhere, status: 'PENDING' },
            }),
            this.prisma.serviceRequest.count({
                where: { ...baseWhere, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
            }),
            this.prisma.serviceRequest.count({
                where: { ...baseWhere, status: 'COMPLETED' },
            }),
            this.prisma.serviceRequest.aggregate({
                where: { ...baseWhere, status: 'COMPLETED' },
                _sum: { acceptedPrice: true },
            }),
        ]);

        return {
            pendingJobs: pending,
            activeJobs: inProgress,
            completedJobs: completed,
            totalEarnings: Number(totalEarnings._sum.acceptedPrice || 0),
        };
    }

    /**
     * Update service request status
     */
    async updateStatus(requestId: string, contractorProfileId: string, status: ServiceStatus) {
        const request = await this.prisma.serviceRequest.findUnique({
            where: { id: requestId },
        });

        if (!request || request.deletedAt) {
            throw new NotFoundException('Service request not found');
        }

        if (request.contractorId !== contractorProfileId) {
            throw new ForbiddenException('You do not have permission to update this request');
        }

        return this.prisma.serviceRequest.update({
            where: { id: requestId },
            data: {
                status,
                ...(status === 'COMPLETED' ? { completedDate: new Date() } : {}),
            },
        });
    }

    /**
     * Get contractor profile ID for a user
     */
    async getContractorProfileId(userId: string): Promise<string | null> {
        const profile = await this.prisma.contractorProfile.findUnique({
            where: { userId },
            select: { id: true },
        });
        return profile?.id || null;
    }
}
