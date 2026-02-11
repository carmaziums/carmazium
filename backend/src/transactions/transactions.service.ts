import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get paginated transactions for a user
     */
    async findByUser(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = { userId, deletedAt: null };

        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            images: true,
                            make: true,
                            model: true,
                            year: true,
                        },
                    },
                },
            }),
            this.prisma.transaction.count({ where }),
        ]);

        return { data, total };
    }

    /**
     * Get earnings summary for a seller
     * Groups transactions by status to determine available, pending, and total
     */
    async getEarningsStats(userId: string) {
        const baseWhere = { userId, deletedAt: null };

        const [completed, pending, allTime] = await Promise.all([
            this.prisma.transaction.aggregate({
                where: { ...baseWhere, status: 'COMPLETED' },
                _sum: { amount: true },
            }),
            this.prisma.transaction.aggregate({
                where: { ...baseWhere, status: 'PENDING' },
                _sum: { amount: true },
            }),
            this.prisma.transaction.aggregate({
                where: baseWhere,
                _sum: { amount: true },
            }),
        ]);

        return {
            available: Number(completed._sum.amount || 0),
            pendingClearance: Number(pending._sum.amount || 0),
            totalYTD: Number(allTime._sum.amount || 0),
        };
    }
}
