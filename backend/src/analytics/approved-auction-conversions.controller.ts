import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ApprovedAuctionConversionsService } from './approved-auction-conversions';

export class CaptureAuctionAttributionDto {
    @IsString() @MaxLength(48) listingId: string;
    @IsString() @Matches(/^\d{1,32}\.\d{1,32}$/) clientId: string;
    @IsOptional() @IsString() @Matches(/^\d{1,20}$/) sessionId?: string;
    @IsISO8601() consentAt: string;
}

@Controller('analytics/auction-attribution')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class ApprovedAuctionConversionsController {
    constructor(private readonly service: ApprovedAuctionConversionsService, private readonly auth: AuthService) {}
    private async userId(req: Request) {
        // Explicit verified bearer identity: cookie-only cross-site requests
        // cannot install another visitor's advertising identifiers.
        const header = req.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
        const user = token ? await this.auth.verifySupabaseToken(token).catch(() => null) : null;
        if (!user?.id) throw new UnauthorizedException();
        return user.id;
    }
    @Post()
    async capture(@Body() body: CaptureAuctionAttributionDto, @Req() req: Request) {
        return this.service.capture(await this.userId(req), body);
    }
    @Post('revoke')
    async revoke(@Req() req: Request) {
        return this.service.revoke(await this.userId(req));
    }
}
