import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { CreateFinanceReferralDto, FinancePreferenceDto } from './finance-referral.dto';
import { FinanceReferralService } from './finance-referral.service';

@Controller('finance/referrals')
@UseGuards(ThrottlerGuard)
export class FinanceReferralController {
    constructor(private readonly referrals: FinanceReferralService) {}

    @Get('listing/:id')
    async availability(@Param('id', ParseUUIDPipe) id: string) {
        return new StandardResponse(await this.referrals.availability(id));
    }

    @Post()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async create(@Body() dto: CreateFinanceReferralDto) {
        return new StandardResponse(await this.referrals.create(dto));
    }

    @Get('preference')
    @UseGuards(SessionAuthGuard)
    async preference(@CurrentUser() user: { id: string }) {
        return new StandardResponse(await this.referrals.preference(user.id));
    }

    @Patch('preference')
    @UseGuards(SessionAuthGuard)
    async updatePreference(@CurrentUser() user: { id: string }, @Body() dto: FinancePreferenceDto) {
        return new StandardResponse(await this.referrals.setPreference(user.id, dto.enabled));
    }
}
