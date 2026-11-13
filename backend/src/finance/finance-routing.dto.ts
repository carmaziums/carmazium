import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class SaveFinanceProviderDto {
    @Transform(trim) @IsString() @Length(2, 100) @Matches(/^[^\r\n]+$/) name: string;
    @Transform(trim) @IsString() @Length(10, 2000) applicationUrl: string;
    @Transform(trim) @IsString() @Length(20, 2000) disclosure: string;
    @Transform(({ obj, key }) => obj[key]) @IsBoolean() enabled: boolean;
    @Transform(({ obj, key }) => obj[key]) @IsBoolean() isDefault: boolean;
}

export class SetListingFinanceRouteDto {
    @IsIn(['DEFAULT', 'PROVIDER', 'OFF']) mode: 'DEFAULT' | 'PROVIDER' | 'OFF';
    @IsOptional() @IsString() @Length(3, 80) providerId?: string;
}
