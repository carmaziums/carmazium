import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';

// Assuming an @User() decorator exists to extract userId
// For now, I'll use a placeholder for demonstration as requested
const User = () => (target: any, key: string, index: number) => { };

@Controller('listings')
export class ListingsController {
    constructor(private readonly listingsService: ListingsService) { }

    @Post()
    create(@Body() createListingDto: CreateListingDto, @User() userId: string = 'demo-user-id') {
        return this.listingsService.create(userId, createListingDto);
    }

    @Get()
    findAll(@Query() filters: ListingFilterDto) {
        return this.listingsService.findAll(filters);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.listingsService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateListingDto: UpdateListingDto,
        @User() userId: string = 'demo-user-id',
    ) {
        return this.listingsService.update(id, userId, updateListingDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() userId: string = 'demo-user-id') {
        return this.listingsService.remove(id, userId);
    }
}
