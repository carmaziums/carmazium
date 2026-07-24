import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMarketingPopupDto } from './dto/update-marketing-popup.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class MarketingService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Singleton config row, created with sensible defaults on first read so
     * the popup keeps working even if no admin has touched this yet.
     */
    async getPopupConfig() {
        const existing = await this.prisma.marketingPopup.findUnique({
            where: { id: SINGLETON_ID },
        });
        if (existing) return existing;

        return this.prisma.marketingPopup.create({
            data: { id: SINGLETON_ID },
        });
    }

    async updatePopupConfig(dto: UpdateMarketingPopupDto, adminUserId: string) {
        return this.prisma.marketingPopup.upsert({
            where: { id: SINGLETON_ID },
            create: {
                id: SINGLETON_ID,
                enabled: dto.enabled ?? true,
                imageUrl: dto.imageUrl,
                linkUrl: dto.linkUrl ?? '/auctions',
                updatedBy: adminUserId,
            },
            update: {
                ...(dto.enabled !== undefined && { enabled: dto.enabled }),
                ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
                ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl }),
                updatedBy: adminUserId,
            },
        });
    }
}
