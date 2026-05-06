import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'The current password of the user',
        example: 'OldPassword123!',
    })
    @IsNotEmpty()
    @IsString()
    oldPassword: string;

    @ApiProperty({
        description: 'The new password to set',
        example: 'NewSecurePassword123!',
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters long' })
    newPassword: string;
}
