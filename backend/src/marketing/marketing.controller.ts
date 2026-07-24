import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { UpdateMarketingPopupDto } from './dto/update-marketing-popup.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Marketing')
@Controller('marketing-popup')
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) { }

    /**
     * Public — read by the storefront popup component for every visitor
     * (including signed-out ones), so no auth guard here.
     */
    @Get()
    @ApiOperation({ summary: 'Get the current marketing popup config' })
    async getConfig() {
        const config = await this.marketingService.getPopupConfig();
        return { success: true, data: config };
    }

    @Patch()
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update the marketing popup config (admin only)' })
    async updateConfig(
        @Body() dto: UpdateMarketingPopupDto,
        @CurrentUser() user: any,
    ) {
        const config = await this.marketingService.updatePopupConfig(dto, user.id);
        return { success: true, data: config };
    }
}
