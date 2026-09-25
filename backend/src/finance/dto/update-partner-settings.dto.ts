import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateFinancePartnerSettingsDto {
    @ApiProperty({ description: 'Finance company or trading name' })
    @IsString()
    @Length(2, 120)
    companyName: string;

    @ApiProperty({
        description: 'Optional HTTPS callback URL reserved for approved partner integrations',
        required: false,
        nullable: true,
    })
    @IsOptional()
    @IsUrl({ protocols: ['https'], require_protocol: true })
    callbackUrl?: string | null;
}
