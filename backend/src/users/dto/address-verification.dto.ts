import { IsString, IsNotEmpty, MinLength, Length } from 'class-validator';

export class StartAddressVerificationDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    address: string;
}

export class ConfirmAddressVerificationDto {
    @IsString()
    @Length(6, 6)
    code: string;
}
