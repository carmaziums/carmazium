import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';

export class AssignSupportRoomDto {
    @IsOptional()
    @IsUUID()
    adminId?: string | null;
}

export class UpdateSupportTagsDto {
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(32, { each: true })
    tags: string[];
}

export class UpdateSupportClosedDto {
    @IsBoolean()
    closed: boolean;
}

export class CreateSupportNoteDto {
    @IsString()
    @MaxLength(2000)
    body: string;
}
