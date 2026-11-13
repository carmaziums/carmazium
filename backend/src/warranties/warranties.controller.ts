import { Body, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import { WarrantiesService } from './warranties.service';
import { CreateWarrantyQuoteDto, IssueWarrantyDto, RefundWarrantyDto, WarrantyAccessDto, WarrantySelectionDto } from './warranty.dto';

@Controller('warranties')
@UseGuards(ThrottlerGuard)
export class WarrantiesController {
    constructor(private readonly warranties: WarrantiesService) {}
    @Post('price') @Throttle({ default: { limit: 60, ttl: 60_000 } })
    price(@Body() dto: WarrantySelectionDto) { return new StandardResponse(this.warranties.price(dto)); }
    @Get('listing/:id')
    async listing(@Param('id', ParseUUIDPipe) id: string) { return new StandardResponse(await this.warranties.listing(id)); }
    @Post('quotes') @UseGuards(OptionalSessionAuthGuard) @Throttle({ default: { limit: 8, ttl: 60_000 } }) @Header('Cache-Control', 'no-store')
    async quote(@Body() dto: CreateWarrantyQuoteDto, @CurrentUser() user?: { id: string }) { return new StandardResponse(await this.warranties.quote(dto, user?.id)); }
    @Get('mine') @UseGuards(SessionAuthGuard) @Header('Cache-Control', 'no-store')
    async mine(@CurrentUser() user: { id: string }) { return new StandardResponse(await this.warranties.mine(user.id)); }
    @Get('orders/:id') @UseGuards(OptionalSessionAuthGuard) @Header('Cache-Control', 'no-store')
    async order(@Param('id', ParseUUIDPipe) id: string, @Headers('x-warranty-token') token?: string, @CurrentUser() user?: { id: string }) {
        return new StandardResponse(await this.warranties.order(id, token, user?.id));
    }
    @Post('orders/:id/checkout') @UseGuards(OptionalSessionAuthGuard) @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Header('Cache-Control', 'no-store')
    async checkout(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WarrantyAccessDto, @CurrentUser() user?: { id: string }) {
        return new StandardResponse(await this.warranties.checkout(id, dto.accessToken, user?.id));
    }
}

@Controller('admin/warranty-orders')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWarrantyOrdersController {
    constructor(private readonly warranties: WarrantiesService) {}
    @Get() @Header('Cache-Control', 'no-store')
    async list(@Query('status') status?: string) { return new StandardResponse(await this.warranties.adminOrders(status)); }
    @Post(':id/issue')
    async issue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IssueWarrantyDto, @CurrentUser() user: { id: string }) {
        return new StandardResponse(await this.warranties.issue(id, dto, user.id));
    }
    @Post(':id/refund')
    async refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundWarrantyDto, @CurrentUser() user: { id: string }) {
        return new StandardResponse(await this.warranties.refund(id, dto.reason, user.id));
    }
}
