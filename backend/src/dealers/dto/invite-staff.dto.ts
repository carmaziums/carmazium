import { IsString, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteStaffDto {
    @ApiProperty({ description: 'Email of the staff member to invite' })
    @IsEmail()
    email: string;

    @ApiProperty({ enum: ['ADMIN', 'SALES_AGENT', 'FINANCE_MANAGER'], description: 'Role to assign' })
    @IsString()
    role: string;
}
