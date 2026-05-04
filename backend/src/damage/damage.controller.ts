import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { DamageAnalysisService } from './damage.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
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
  ) {
    await this.damageService.saveDamageRecords(listingId, body.detections);
    return { success: true };
  }

  @Get(':listingId')
  @ApiOperation({ summary: 'Get damage records for a listing' })
  async get(@Param('listingId') listingId: string) {
    const records = await this.damageService.getDamageRecords(listingId);
    return {
      success: true,
      data: records,
    };
  }
}
