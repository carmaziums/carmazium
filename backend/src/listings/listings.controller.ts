import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        return 'demo-user-id';
    },
);

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
