/* ============================================================================
 * AUCTIONS CONTROLLER — FROZEN
 * ============================================================================
 * Auctions have been temporarily disabled by client decision.
 * Only the /auctions/status endpoint is active.
 * All original routes are preserved in AUCTION_DISABLED blocks below.
 * To re-enable: uncomment all AUCTION_DISABLED blocks and remove the status-only route.
 * ============================================================================ */

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/* AUCTION_DISABLED — original imports kept for easy re-enable
import {
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { ApiCookieAuth } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auction } from '@prisma/client';
import { StandardResponse } from '../listings/dto/response.dto';
*/

@ApiTags('Auctions')
@Controller('auctions')
export class AuctionsController {
    /* AUCTION_DISABLED
    constructor(private readonly auctionsService: AuctionsService) { }
    */

    // ── Active Route: Status Check ─────────────────────────────────────────
    /**
     * Returns the current operational status of the auctions feature.
     * Frontend uses this to determine whether to show Coming Soon or live auction UI.
     */
    @Get('status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get auctions feature status' })
    @ApiResponse({
        status: 200,
        description: 'Auctions feature status',
        schema: {
            example: { status: 'coming_soon', message: 'Auctions are coming soon. Stay tuned!' },
        },
    })
    getStatus() {
        return {
            status: 'coming_soon',
            message: 'Auctions are coming soon. Stay tuned!',
        };
    }

    /* AUCTION_DISABLED — All original routes below. Uncomment to re-enable.

    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new auction' })
    @ApiResponse({ status: 201, description: 'Auction created successfully' })
    async create(
        @Body() createAuctionDto: CreateAuctionDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Auction>> {
        const auction = await this.auctionsService.create(createAuctionDto, user.id);
        return new StandardResponse(auction);
    }

    @Get('active')
    @ApiOperation({ summary: 'Get all active auctions' })
    @ApiResponse({ status: 200, description: 'List of active auctions' })
    async findAllActive(): Promise<StandardResponse<Auction[]>> {
        const auctions = await this.auctionsService.findAllActive();
        return new StandardResponse(auctions);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get auction details' })
    @ApiResponse({ status: 200, description: 'Auction details' })
    @ApiResponse({ status: 404, description: 'Auction not found' })
    async findOne(@Param('id') id: string): Promise<StandardResponse<Auction>> {
        const auction = await this.auctionsService.findOne(id);
        return new StandardResponse(auction);
    }

    @Patch(':id')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Update an auction' })
    @ApiResponse({ status: 200, description: 'Auction updated successfully' })
    async update(
        @Param('id') id: string,
        @Body() updateAuctionDto: UpdateAuctionDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Auction>> {
        const auction = await this.auctionsService.update(id, updateAuctionDto, user.id);
        return new StandardResponse(auction);
    }

    @Delete(':id')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Delete an auction' })
    @ApiResponse({ status: 200, description: 'Auction deleted' })
    async remove(
        @Param('id') id: string,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<Auction>> {
        const auction = await this.auctionsService.remove(id, user.id);
        return new StandardResponse(auction);
    }

    AUCTION_DISABLED */
}
