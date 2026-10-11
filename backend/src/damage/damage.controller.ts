import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DamageAnalysisService } from './damage.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Damage Analysis')
@Controller('damage')
export class DamageAnalysisController {
  constructor(private readonly damageService: DamageAnalysisService) {}

  @Post('analyze')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Run AI damage analysis on images' })
  async analyze(@Body() body: { imageUrls: string[] }) {
    const detections = await this.damageService.analyzeImages(body.imageUrls);
    return {
      success: true,
      data: detections,
    };
  }

  @Post(':listingId/save')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Save detected damage records for a listing' })
  async save(
    @Param('listingId') listingId: string,
    @Body() body: { detections: any[] },
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    // main.ts may hydrate req.user from a cached session identity. The session
    // userId is the canonical principal for cookie auth; Bearer-token fallback
    // sets it after verification. Never authorize using a conflicting cache.
    const principal = request.session?.userId ?? user?.id;
    await this.damageService.saveDamageRecords(listingId, body?.detections, principal);
    return { success: true };
  }

  @Get(':listingId')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Get damage records; private drafts require listing owner or dealer permission' })
  async get(
    @Param('listingId') listingId: string,
    @CurrentUser() user?: { id: string },
    @Req() request?: Request,
  ) {
    const principal = request?.session?.userId ?? user?.id;
    const records = await this.damageService.getDamageRecords(listingId, principal);
    return {
      success: true,
      data: records,
    };
  }
}
