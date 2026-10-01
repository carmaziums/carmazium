import { Controller, DefaultValuePipe, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SimpleDmsGuard } from './simpledms.guard';
import { SimpleDmsService } from './simpledms.service';

/**
 * Intentionally omitted from the general public Swagger documentation. The
 * scoped partner contract is maintained in docs/integrations/simpledms.md.
 */
@ApiExcludeController()
@Controller('partners/v1/simpledms')
@UseGuards(SimpleDmsGuard, ThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
export class SimpleDmsController {
  constructor(private readonly service: SimpleDmsService) {}

  @Get('auctions')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex')
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.service.list(page, limit);
  }

  @Get('auctions/:id')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }
}
