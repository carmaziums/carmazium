import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, IsUUID, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateFinanceReferralDto {
    @IsUUID() requestId: string;
    @IsUUID() listingId: string;
    @Transform(trim) @IsString() @Length(2, 120) fullName: string;
    @Transform(trim) @IsEmail() @Length(3, 254) email: string;
    @Transform(trim) @IsString() @Length(7, 30)
    @Matches(/^\+?[\d\s().-]+$/) phone: string;
    @Transform(({ obj, key }) => obj[key])
    @Equals(true) consent: boolean;
}

export class FinancePreferenceDto {
    @Transform(({ obj, key }) => obj[key])
    @IsBoolean() enabled: boolean;
}
