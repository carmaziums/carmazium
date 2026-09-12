import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { CreateServiceLeadDto, RespondToServiceLeadDto } from './service-leads.dto';
import { ServiceLeadsService } from './service-leads.service';

@ApiTags('Trade Exchange service enquiries')
@ApiCookieAuth()
@Controller('services')
@UseGuards(SessionAuthGuard)
export class ServiceLeadsController {
    constructor(private readonly leads: ServiceLeadsService) { }

    @Post('leads')
    @ApiOperation({ summary: 'Create a Vehicle Finance or Warranty enquiry and match approved providers' })
    async create(@CurrentUser() user: any, @Body() dto: CreateServiceLeadDto) {
        return new StandardResponse(await this.leads.create(user.id, dto));
    }

    // Static routes stay above /leads/:id so Nest never treats "my" or
    // "inbox" as an enquiry id.
    @Get('leads/my')
    @ApiOperation({ summary: 'My Finance and Warranty enquiries' })
    async my(@CurrentUser() user: any) {
        return new StandardResponse(await this.leads.myLeads(user.id));
    }

    @Get('leads/inbox')
    @ApiQuery({ name: 'serviceType', enum: [ServiceType.FINANCE, ServiceType.WARRANTY], required: false })
    @ApiOperation({ summary: 'Matched enquiries for an approved Finance/Warranty provider' })
    async inbox(@CurrentUser() user: any, @Query('serviceType') serviceType?: string) {
        return new StandardResponse(
            await this.leads.inbox(user.id, serviceType as ServiceType | undefined),
        );
    }

    @Put('leads/:id/respond')
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
