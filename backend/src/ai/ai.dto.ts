import { IsString, IsNotEmpty, IsArray, ValidateNested, IsIn, IsOptional, IsEnum, MaxLength, ArrayMaxSize, IsBoolean, Equals } from 'class-validator';
import { Type } from 'class-transformer';
import { AiReportReason, AiReportStatus } from '@prisma/client';

export class AiSearchDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    query: string;

    @IsBoolean()
    @Equals(true, { message: 'AI data-sharing consent is required' })
    aiConsentAcknowledged: boolean;
}

class ChatMessageDto {
    @IsString()
    @IsIn(['user', 'assistant'])
    role: 'user' | 'assistant';

    @IsString()
    @IsNotEmpty()
    @MaxLength(4000)
    content: string;
}

export class AiChatDto {
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    messages: ChatMessageDto[];

    @IsBoolean()
    @Equals(true, { message: 'AI data-sharing consent is required' })
    aiConsentAcknowledged: boolean;
}

export class AiDescriptionDto {
    @IsBoolean()
    @Equals(true, { message: 'AI data-sharing consent is required' })
    aiConsentAcknowledged: boolean;

    @IsOptional()
    @IsString()
    make?: string;

    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsString()
    year?: string;

    @IsOptional()
    @IsString()
    mileage?: string;

    @IsOptional()
    @IsString()
    condition?: string;

    @IsOptional()
    @IsString()
    fuelType?: string;

    @IsOptional()
    @IsString()
    transmission?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsString()
    vrm?: string;

    @IsOptional()
    @IsString()
    motStatus?: string;

    @IsOptional()
    @IsString()
    engineSize?: string;

    @IsOptional()
    @IsString()
    bodyType?: string;

    @IsOptional()
    @IsString()
    serviceHistory?: string;

    @IsOptional()
    @IsString()
    owners?: string;
}


export class AiReportDto {
    @IsIn(['WEB', 'NATIVE'])
    surface: 'WEB' | 'NATIVE';

    @IsOptional()
    @IsString()
    @MaxLength(4000)
    prompt?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(6000)
    response: string;

    @IsEnum(AiReportReason)
    reason: AiReportReason;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    details?: string;
}

export class UpdateAiReportDto {
    @IsEnum(AiReportStatus)
    status: AiReportStatus;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    adminNote?: string;
}
