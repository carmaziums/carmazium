import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { CreateServiceLeadDto, RespondToServiceLeadDto, ServiceLeadInboxQueryDto, ServiceLeadListQueryDto } from './service-leads.dto';
import { ServiceLeadsService } from './service-leads.service';

@ApiTags('Trade Exchange service enquiries')
@ApiCookieAuth()
@Controller('services')
@UseGuards(SessionAuthGuard, ThrottlerGuard)
export class ServiceLeadsController {
    constructor(private readonly leads: ServiceLeadsService) { }

    @Post('leads')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @ApiOperation({ summary: 'Create a Vehicle Finance or Warranty enquiry and match approved providers' })
    async create(@CurrentUser() user: any, @Body() dto: CreateServiceLeadDto) {
        return new StandardResponse(await this.leads.create(user.id, dto));
    }

    // Static routes stay above /leads/:id so Nest never treats "my" or
    // "inbox" as an enquiry id.
    @Get('leads/my')
    @ApiOperation({ summary: 'My Finance and Warranty enquiries' })
    async my(@CurrentUser() user: any, @Query() query: ServiceLeadListQueryDto) {
        return new StandardResponse(await this.leads.myLeadsPage(user.id, query));
    }

    @Get('leads/inbox')
    @ApiOperation({ summary: 'Matched Finance/Warranty enquiries for an approved provider (cursor paginated)' })
    async inbox(@CurrentUser() user: any, @Query() query: ServiceLeadInboxQueryDto) {
        return new StandardResponse(
            await this.leads.inboxPage(user.id, query.serviceType, query),
        );
    }

    @Get('leads/inbox/:id')
    @ApiOperation({ summary: 'Open one matched Finance/Warranty enquiry in the provider dashboard' })
    async providerLead(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.leads.providerLead(user.id, id));
    }

    @Put('leads/:id/respond')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    @ApiOperation({ summary: 'Respond to a matched Finance/Warranty enquiry — no CarMazium payment is created' })
    async respond(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: RespondToServiceLeadDto,
    ) {
        return new StandardResponse(await this.leads.respond(user.id, id, dto));
    }

    @Post('leads/:id/close')
    @ApiOperation({ summary: 'Close one of my open Finance/Warranty enquiries' })
    async close(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.leads.close(user.id, id));
    }

    @Get('leads/:id')
    @ApiOperation({ summary: 'My enquiry and responses from approved providers' })
    async one(@CurrentUser() user: any, @Param('id') id: string) {
        return new StandardResponse(await this.leads.customerLead(user.id, id));
    }
}
