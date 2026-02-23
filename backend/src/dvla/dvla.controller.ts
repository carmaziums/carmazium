import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { DvlaService, DvlaLookupResult } from './dvla.service';

// ─── Request DTO ──────────────────────────────────────────────────────────────

class DvlaLookupDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^[A-Za-z0-9 ]{2,8}$/, { message: 'Must be a valid UK registration number' })
    vrm: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('dvla')
@Controller('dvla')
export class DvlaController {
    constructor(private readonly dvlaService: DvlaService) { }

    @Post('lookup')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    @ApiOperation({ summary: 'Look up a UK vehicle by registration number via DVLA VES API' })
    @ApiBody({ schema: { properties: { vrm: { type: 'string', example: 'AB12CDE' } } } })
    @ApiResponse({ status: 200, description: 'Vehicle data returned successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or unrecognised registration number' })
    @ApiResponse({ status: 503, description: 'DVLA API key not configured or DVLA service unavailable' })
    async lookup(@Body() dto: DvlaLookupDto): Promise<DvlaLookupResult> {
        return this.dvlaService.lookupVrm(dto.vrm);
    }
}
