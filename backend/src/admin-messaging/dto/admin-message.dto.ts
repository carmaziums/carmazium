import { UserRole } from '@prisma/client';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export enum AdminMessageAudience {
    ALL = 'ALL',
    ROLE = 'ROLE',
    PERSON = 'PERSON',
    DEALERS = 'DEALERS',
    SERVICE_PROVIDERS = 'SERVICE_PROVIDERS',
    DELIVERY_PROVIDERS = 'DELIVERY_PROVIDERS',
    INSPECTION_PROVIDERS = 'INSPECTION_PROVIDERS',
    FINANCE_PROVIDERS = 'FINANCE_PROVIDERS',
    WARRANTY_PROVIDERS = 'WARRANTY_PROVIDERS',
    INSURANCE_PROVIDERS = 'INSURANCE_PROVIDERS',
}

export enum AdminMediaKind {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
}

export class AdminAudienceDto {
    @IsEnum(AdminMessageAudience)
    audience: AdminMessageAudience;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsUUID()
    userId?: string;
}

export class AdminSendMessageDto extends AdminAudienceDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    text?: string;

    @IsOptional()
    @IsUrl({ require_protocol: true })
    @MaxLength(2000)
    mediaUrl?: string;

    @IsOptional()
    @IsEnum(AdminMediaKind)
    mediaKind?: AdminMediaKind;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    mediaName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    mediaMime?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(25 * 1024 * 1024)
    mediaSize?: number;

    /**
     * Safety latch: the admin UI previews the audience first and sends the
     * count it showed. If membership changes before Send is confirmed, the
     * backend refuses the broadcast instead of silently messaging a different
     * number of people.
     */
    @IsInt()
    @Min(1)
    @Max(100000)
    expectedRecipientCount: number;
}
