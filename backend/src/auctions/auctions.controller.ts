import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
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
    async findAllScheduled(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const result = await this.auctionsService.findAllScheduled(+page, +limit);
        return new StandardResponse(result);
    }

    // ── Authenticated Routes ──────────────────────────────────────────────────

    @Get('my/list')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: "Get the current user's auctions" })
    async findMyAuctions(
        @CurrentUser() user: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const result = await this.auctionsService.findMyAuctions(user.id, +page, +limit);
        return new StandardResponse(result);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get full auction details by ID' })
    @ApiResponse({ status: 200, description: 'Auction details with bids and listing' })
    @ApiResponse({ status: 404, description: 'Auction not found' })
    async findOne(@Param('id') id: string) {
        const auction = await this.auctionsService.findOne(id);
        return new StandardResponse(auction);
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

    @Post(':id/handover-proof')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit handover proof for an ended auction (seller only)' })
    @ApiResponse({ status: 200, description: 'Proof submitted — £100 seller bonus pending admin verification' })
    @ApiResponse({ status: 400, description: 'Auction not ended, no winner, or proof already submitted' })
    @ApiResponse({ status: 403, description: 'You do not own this auction' })
    async submitHandoverProof(
        @Param('id') id: string,
        @Body('proofUrl') proofUrl: string,
        @CurrentUser() user: any,
    ) {
        if (!proofUrl) {
            throw new BadRequestException('proofUrl is required');
        }
        const result = await this.auctionsService.submitHandoverProof(id, user.id, proofUrl);
        return new StandardResponse(result);
    }
}
