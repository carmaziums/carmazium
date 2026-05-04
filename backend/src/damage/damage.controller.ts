import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { DamageAnalysisService } from './damage.service';

@Controller('damage')
export class DamageAnalysisController {
  constructor(private readonly damageService: DamageAnalysisService) {}

  @Post('analyze')
  async analyze(@Body() body: { imageUrls: string[] }) {
    const detections = await this.damageService.analyzeImages(body.imageUrls);
    return {
      success: true,
      data: detections,
    };
  }

  @Post(':listingId/save')
  async save(
    @Param('listingId') listingId: string,
    @Body() body: { detections: any[] },
  ) {
    await this.damageService.saveDamageRecords(listingId, body.detections);
    return { success: true };
  }

  @Get(':listingId')
  async get(@Param('listingId') listingId: string) {
    const records = await this.damageService.getDamageRecords(listingId);
    return {
      success: true,
      data: records,
    };
  }
}
