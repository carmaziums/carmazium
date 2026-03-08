import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


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

    @ApiPropertyOptional({ enum: ['BUYER', 'SELLER', 'ADMIN'], default: 'BUYER' })
    @IsOptional()
    @IsEnum(['BUYER', 'SELLER', 'ADMIN'])
    role?: 'BUYER' | 'SELLER' | 'ADMIN';
}
