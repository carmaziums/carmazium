import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { PartnerAgreementService, type PartnerAgreementAcceptanceInput } from './partner-agreement.service';

@ApiTags('Business Partner Agreement')
@Controller('legal/partner-agreement')
export class PartnerAgreementController {
  constructor(private readonly agreement: PartnerAgreementService) {}

  @Get('document')
  @ApiOperation({ summary: 'Read the full current Business Partner Agreement and immutable document fingerprint' })
  document() {
    return new StandardResponse(this.agreement.document());
  }

  @Get('status')
  @ApiCookieAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Authenticated business agreement acceptance and exact signed version' })
  async status(@CurrentUser() user: any) {
    return new StandardResponse(await this.agreement.status(user.id));
  }

  @Post('accept')
  @ApiCookieAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Electronically sign the full exact agreement as an authorised business owner' })
  async accept(@CurrentUser() user: any, @Body() body: PartnerAgreementAcceptanceInput, @Req() req: Request) {
    return new StandardResponse(await this.agreement.accept(user.id, body, {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
    }));
  }
}
