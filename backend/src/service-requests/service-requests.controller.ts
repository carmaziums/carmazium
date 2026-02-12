import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';
import { ServiceRequest } from '@prisma/client';

@ApiTags('Service Requests')
@Controller('service-requests')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard)
export class ServiceRequestsController {
    constructor(
        private readonly serviceRequestsService: ServiceRequestsService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new service request' })
    @ApiResponse({ status: 201, description: 'Request created' })
    async create(
        @Body() createDto: CreateServiceRequestDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<ServiceRequest>> {
        const request = await this.serviceRequestsService.create(user.id, createDto);
        // @ts-ignore - Prisma types might need refresh but runtime is fine
        return new StandardResponse(request);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get my service requests (as requester)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findMyRequests(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<ServiceRequest>> {
        const { data, total } = await this.serviceRequestsService.findByRequester(
            user.id,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get('contractor')
    @ApiOperation({ summary: 'Get my service requests (as contractor)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findMyJobs(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<ServiceRequest>> {
        const contractorId = await this.serviceRequestsService.getContractorProfileId(user.id);

        if (!contractorId) {
            return new PaginatedResponse([], 0, Number(page), Number(limit));
        }

        const { data, total } = await this.serviceRequestsService.findByContractor(
            contractorId,
            Number(page),
            Number(limit),
        );
        // @ts-ignore
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get('contractor/stats')
    @ApiOperation({ summary: 'Get contractor dashboard statistics' })
    async getContractorStats(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const contractorId = await this.serviceRequestsService.getContractorProfileId(user.id);

        if (!contractorId) {
            return new StandardResponse({
                pendingJobs: 0,
                activeJobs: 0,
                completedJobs: 0,
                totalEarnings: 0,
            });
        }

        const stats = await this.serviceRequestsService.getContractorStats(contractorId);
        return new StandardResponse(stats);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update service request status' })
    @ApiParam({ name: 'id', description: 'UUID of the service request' })
    async updateStatus(
        @Param('id') id: string,
        @Body() updateDto: UpdateServiceStatusDto,
        @CurrentUser() user: any,
    ): Promise<StandardResponse<ServiceRequest>> {
        const contractorId = await this.serviceRequestsService.getContractorProfileId(user.id);

        if (!contractorId) {
            throw new ForbiddenException('User is not a contractor');
        }

        const request = await this.serviceRequestsService.updateStatus(
            id,
            contractorId,
            updateDto,
        );
        // @ts-ignore
        return new StandardResponse(request);
    }
}
