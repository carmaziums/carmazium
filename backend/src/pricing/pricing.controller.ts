import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { EstimatePriceDto } from './pricing.dto';

@Controller('pricing')
export class PricingController {
    private readonly logger = new Logger(PricingController.name);

    constructor(private readonly pricingService: PricingService) {}

    @Post('estimate')
    @HttpCode(HttpStatus.OK)
    async estimatePrice(@Body() dto: EstimatePriceDto) {
        this.logger.log(`Estimating price for ${dto.make} ${dto.model} (${dto.year})`);
        return this.pricingService.estimatePrice(dto);
    }
}
