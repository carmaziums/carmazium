import {
    Controller,
    Get,
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
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auction } from '@prisma/client';
import { StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Auctions')
@Controller('auctions')
export class AuctionsController {
    constructor(private readonly auctionsService: AuctionsService) { }

    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
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
}
