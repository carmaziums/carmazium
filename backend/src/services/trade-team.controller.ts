import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import { TradeTeamPermissionInput, TradeTeamService } from './trade-team.service';

@ApiTags('Trade Exchange dealership team')
@ApiCookieAuth()
@Controller('services/team')
@UseGuards(SessionAuthGuard)
export class TradeTeamController {
    constructor(private readonly tradeTeam: TradeTeamService) { }

    @Get()
    @ApiOperation({ summary: 'Dealership owner TradeXchange team permissions and business provider status' })
    async team(@CurrentUser() user: any) {
        return new StandardResponse(await this.tradeTeam.listTeam(user.id));
    }

    @Put('permissions')
    @ApiOperation({ summary: 'Grant or update one staff member’s Delivery/Inspection permissions' })
    async permissions(@CurrentUser() user: any, @Body() body: TradeTeamPermissionInput) {
        return new StandardResponse(await this.tradeTeam.setPermissions(user.id, body));
    }

    @Post('capabilities/:serviceType')
    @ApiOperation({ summary: 'Apply the dealership business to provide Delivery or Inspection services' })
    async capability(@CurrentUser() user: any, @Param('serviceType') serviceType: string) {
        return new StandardResponse(
            await this.tradeTeam.applyBusinessCapability(user.id, serviceType as ServiceType),
        );
    }
}
