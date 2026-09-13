import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { StandardResponse } from '../listings/dto/response.dto';
import {
    FreeListingEntitlementService,
    GrantFreeListingInput,
} from './free-listing-entitlement.service';

@ApiTags('Admin - Free Listings')
@Controller('admin/free-listings')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FreeListingsAdminController {
    constructor(private readonly freeListings: FreeListingEntitlementService) { }

    @Get('users/:id')
    @ApiOperation({ summary: 'Get a registered user free-listing entitlement' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    async getUserGrant(@Param('id') id: string) {
        return new StandardResponse(await this.freeListings.getUserGrant(id));
    }

    @Patch('users/:id')
    @ApiOperation({
        summary: 'Admin only: grant one free retail listing, timed free listings, one month, or free forever',
    })
    @ApiParam({ name: 'id', description: 'User UUID' })
    async grant(
        @Param('id') id: string,
        @Body() input: GrantFreeListingInput,
        @CurrentUser() admin: any,
    ) {
        return new StandardResponse(await this.freeListings.grant(id, input, admin.id));
    }

    @Delete('users/:id')
    @ApiOperation({ summary: 'Admin only: revoke a user free-listing entitlement' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    async revoke(@Param('id') id: string) {
        return new StandardResponse(await this.freeListings.revoke(id));
    }
}
