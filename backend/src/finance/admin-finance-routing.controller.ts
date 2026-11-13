import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { FinanceRoutingService } from './finance-routing.service';
import { SaveFinanceProviderDto, SetListingFinanceRouteDto } from './finance-routing.dto';

@Controller('admin/finance-routing')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFinanceRoutingController {
    constructor(private readonly routing: FinanceRoutingService) {}
    @Get('providers') async providers() { return new StandardResponse(await this.routing.list()); }
    @Get('referrals') @Header('Cache-Control', 'no-store') async referrals() { return new StandardResponse(await this.routing.referrals()); }
    @Post('providers') async create(@CurrentUser() user: { id: string }, @Body() dto: SaveFinanceProviderDto) { return new StandardResponse(await this.routing.save(user.id, dto)); }
    @Put('providers/:id') async update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: SaveFinanceProviderDto) { return new StandardResponse(await this.routing.save(user.id, dto, id)); }
    @Get('listings') async listings(@Query('q') q?: string) { return new StandardResponse(await this.routing.listings(q)); }
    @Put('listings/:id') async listing(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetListingFinanceRouteDto) { return new StandardResponse(await this.routing.setListing(user.id, id, dto)); }
}
