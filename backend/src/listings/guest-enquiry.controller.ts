import { Body, Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from './dto/response.dto';
import { GuestEnquiryDto, VerifyGuestEnquiryDto } from './guest-enquiry.dto';
import { GuestEnquiryService } from './guest-enquiry.service';

@Controller('listing-enquiries')
@UseGuards(ThrottlerGuard)
export class GuestEnquiryController {
    constructor(private readonly enquiries: GuestEnquiryService) {}
    @Post() @Throttle({ default: { limit: 3, ttl: 60_000 } })
    async start(@Body() dto: GuestEnquiryDto) { return new StandardResponse(await this.enquiries.start(dto)); }
    @Post('verify') @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async verify(@Body() dto: VerifyGuestEnquiryDto) { return new StandardResponse(await this.enquiries.verify(dto)); }
    @Get('mine') @Header('Cache-Control', 'private, no-store') @UseGuards(SessionAuthGuard)
    async mine(@CurrentUser() user: { id: string }) { return new StandardResponse(await this.enquiries.mine(user.id)); }
}
