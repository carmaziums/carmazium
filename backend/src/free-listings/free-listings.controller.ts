import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PaginatedResponse, StandardResponse } from '../listings/dto/response.dto';
import {
    FreeListingDurationUnit,
    FreeListingGrantsService,
} from './free-listing-grants.service';

@ApiTags('Admin Free Listings')
@ApiCookieAuth()
@Controller('admin/free-listings')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFreeListingsController {
    constructor(private readonly grants: FreeListingGrantsService) {}

    @Get('users')
    @ApiOperation({ summary: 'List registered users with their admin-granted free listing entitlement' })
    async listUsers(
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('search') search?: string,
    ): Promise<PaginatedResponse<any>> {
        const result = await this.grants.listUsers(Number(page), Number(limit), search);
        return new PaginatedResponse(result.data, result.total, result.page, result.limit);
    }

    @Post('users/:id')
    @ApiOperation({ summary: 'Grant one free BASIC retail vehicle listing to a registered user' })
    async grantOneFreeListing(
        @Param('id') userId: string,
        @Body('durationUnit') durationUnit: FreeListingDurationUnit,
        @Body('durationValue') durationValue: number | undefined,
        @CurrentUser() admin: any,
    ): Promise<StandardResponse<any>> {
        const grant = await this.grants.grant(userId, admin.id, durationUnit, durationValue);
        return new StandardResponse(grant);
    }

    @Delete('users/:id')
    @ApiOperation({ summary: 'Revoke a user free-listing entitlement if it has not been used' })
    async revokeFreeListing(@Param('id') userId: string): Promise<StandardResponse<any>> {
        const grant = await this.grants.revoke(userId);
        return new StandardResponse(grant);
    }
}
