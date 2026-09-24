import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import { TradeTeamService } from './trade-team.service';
import { UpdateTradeTeamPermissionsDto } from './trade-team.dto';
import { ProductSyncGateway } from '../sync/product-sync.gateway';

@ApiTags('Trade Exchange dealership team')
@ApiCookieAuth()
@Controller('services/team')
@UseGuards(SessionAuthGuard)
export class TradeTeamController {
    constructor(
        private readonly tradeTeam: TradeTeamService,
        private readonly productSync: ProductSyncGateway,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Partner business TradeXchange permissions and provider capability status' })
    async team(@CurrentUser() user: any) {
        return new StandardResponse(await this.tradeTeam.listTeam(user.id));
    }

    @Put('permissions')
    @ApiOperation({ summary: 'Grant or update one staff member’s Delivery/Inspection permissions' })
    async permissions(@CurrentUser() user: any, @Body() body: UpdateTradeTeamPermissionsDto) {
        const result = await this.tradeTeam.setPermissions(user.id, body);
        this.productSync.broadcast({ domain: 'services', action: 'team-permissions-updated' });
        return new StandardResponse(result);
    }

    @Post('capabilities/:serviceType')
    @ApiOperation({ summary: 'Apply the Partner business to provide Delivery, Inspection, Finance or Warranty services' })
    async capability(@CurrentUser() user: any, @Param('serviceType') serviceType: string) {
        const result = await this.tradeTeam.applyBusinessCapability(user.id, serviceType as ServiceType);
        this.productSync.broadcast({ domain: 'services', action: 'business-capability-applied' });
        return new StandardResponse(result);
    }
}
