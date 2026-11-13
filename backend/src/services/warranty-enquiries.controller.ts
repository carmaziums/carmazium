import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { StandardResponse } from '../listings/dto/response.dto';
import { WarrantyAvailabilityDto } from './service-leads.dto';
import { ServiceLeadsService } from './service-leads.service';

/** Read-only, rate-limited discovery before collecting a buyer's contact details. */
@ApiTags('Warranty enquiries')
@Controller('services/warranty')
@UseGuards(ThrottlerGuard)
export class WarrantyEnquiriesController {
    constructor(private readonly leads: ServiceLeadsService) { }

    @Get('listing/:id')
    @Header('Cache-Control', 'no-store')
    @Throttle({ default: { limit: 60, ttl: 60_000 } })
    @ApiOperation({ summary: 'Public vehicle details for an active retail warranty enquiry' })
    async listing(@Param('id', ParseUUIDPipe) id: string) {
        return new StandardResponse(await this.leads.warrantyListing(id));
    }

    @Get('availability')
    @Header('Cache-Control', 'no-store')
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    @ApiOperation({ summary: 'Check warranty provider availability without saving an enquiry' })
    async availability(@Query() dto: WarrantyAvailabilityDto) {
        return new StandardResponse({ available: false, providerCount: 0 });
    }
}
