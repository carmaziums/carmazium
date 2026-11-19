import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class GuestEnquiryDto {
    @IsUUID() listingId: string;
    @Transform(trim) @IsString() @Length(2, 120) fullName: string;
    @Transform(trim) @IsEmail() @Length(3, 254) email: string;
    @Transform(trim) @IsOptional() @IsString() @Length(0, 30) @Matches(/^[+\d\s().-]*$/) phone?: string;
    @Transform(trim) @IsString() @Length(10, 2000) message: string;
    @Transform(({ obj, key }) => obj[key]) @Equals(true) consent: boolean;
    @IsOptional() @Equals('') website?: string;
}
export class VerifyGuestEnquiryDto {
    @IsUUID() id: string;
    @IsString() @Matches(/^\d{6}$/) code: string;
}
