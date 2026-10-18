import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AuthService } from '../auth/auth.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SimpleDmsReferralService } from './simpledms-referral.service';

@ApiExcludeController()
@Controller('partners/referrals/simpledms')
export class SimpleDmsReferralController {
  constructor(private readonly service: SimpleDmsReferralService, private readonly auth: AuthService) {}

  // Redirect endpoint intended for use only as a SimpleDMS deep link.
  @Get('go/:id')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Header('Cache-Control', 'no-store')
  async go(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const location = await this.service.visit(id, expires, signature);
    // Fixed-origin destination built server-side; no caller-supplied return URL.
    return res.redirect(302, location);
  }

  @Post('claim')
  @UseGuards(SessionAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  async claim(@Req() req: Request, @Body('token') token: string) {
    // Stronger than session-cookie-only: require current browser Supabase bearer
    // so a third-party site cannot submit claims with cross-site cookies.
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new BadRequestException('Authenticated bearer token required');
    }
    const user = (req as Request & { user?: { id: string; role: string } }).user;
    if (!user?.id) throw new BadRequestException('Authenticated dealer required');
    // Do not merely check the header exists. SessionAuthGuard can trust an
    // existing session and skip the bearer; verify this token separately.
    const verified = await this.auth.verifySupabaseToken(header.slice(7));
    if (!verified || verified.id !== user.id) {
      throw new BadRequestException('Bearer token must match current dealer');
    }
    return this.service.claim(user.id, verified.role, token);
  }

  @Get('report')
  @UseGuards(SessionAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  @Header('Cache-Control', 'private, no-store')
  async report(@Query('days') days = '90') {
    if (!/^\d{1,2}$/.test(days) && days !== '90') throw new BadRequestException('Invalid days');
    return this.service.report(Number(days));
  }
}
