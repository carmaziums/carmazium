import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SELF_SERVICE_USER_ROLES } from '../../core/account-roles';

export class RegisterDto {
    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'SecurePass123', description: 'Password (min 8 characters)' })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ example: '+44 7911 123456' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({
        enum: SELF_SERVICE_USER_ROLES,
        default: UserRole.BUYER,
        description: 'Self-service account role. Privileged staff/partner roles cannot be self-registered.',
    })
    @IsOptional()
    @IsIn([...SELF_SERVICE_USER_ROLES])
    role?: UserRole;
}
