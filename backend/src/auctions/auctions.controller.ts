import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Auctions')
@Controller('auctions')
export class AuctionsController {
    constructor(private readonly auctionsService: AuctionsService) { }

    // ── Public Routes ─────────────────────────────────────────────────────────

    @Get('active')
    @ApiOperation({ summary: 'Get all live (ACTIVE) auctions' })
    @ApiResponse({ status: 200, description: 'List of active auctions' })
    async findAllActive() {
        const auctions = await this.auctionsService.findAllActive();
        return new StandardResponse(auctions);
    }

    @Get('scheduled')
    @ApiOperation({ summary: 'Get all upcoming (SCHEDULED) auctions' })
    @ApiResponse({ status: 200, description: 'List of scheduled auctions' })
    async findAllScheduled() {
        const auctions = await this.auctionsService.findAllScheduled();
        return new StandardResponse(auctions);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get full auction details by ID' })
    @ApiResponse({ status: 200, description: 'Auction details with bids and listing' })
    @ApiResponse({ status: 404, description: 'Auction not found' })
    async findOne(@Param('id') id: string) {
        const auction = await this.auctionsService.findOne(id);
        return new StandardResponse(auction);
    }

    // ── Authenticated Routes ──────────────────────────────────────────────────

    @Get('my/list')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: "Get the current user's auctions" })
    async findMyAuctions(@CurrentUser() user: any) {
        const auctions = await this.auctionsService.findMyAuctions(user.id);
        return new StandardResponse(auctions);
    }

    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new auction for a listing you own' })
    @ApiResponse({ status: 201, description: 'Auction created. endTime = startTime + 5 hours.' })
    @ApiResponse({ status: 400, description: 'Validation error or auction already exists' })
    @ApiResponse({ status: 403, description: 'You do not own this listing' })
    async create(@Body() createAuctionDto: CreateAuctionDto, @CurrentUser() user: any) {
        const auction = await this.auctionsService.create(createAuctionDto, user.id);
        return new StandardResponse(auction);
    }

    @Patch(':id')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Update a SCHEDULED auction (startTime, reserve, increments)' })
    @ApiResponse({ status: 400, description: 'Cannot update an ACTIVE or ENDED auction' })
    async update(
        @Param('id') id: string,
        @Body() updateAuctionDto: UpdateAuctionDto,
        @CurrentUser() user: any,
    ) {
        const auction = await this.auctionsService.update(id, updateAuctionDto, user.id);
        return new StandardResponse(auction);
    }

    @Patch(':id/cancel')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel a SCHEDULED auction' })
    async cancel(@Param('id') id: string, @CurrentUser() user: any) {
        const auction = await this.auctionsService.cancel(id, user.id);
        return new StandardResponse(auction);
    }

    @Delete(':id')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft-delete a SCHEDULED auction' })
    async remove(@Param('id') id: string, @CurrentUser() user: any) {
        const auction = await this.auctionsService.remove(id, user.id);
        return new StandardResponse(auction);
    }
}
