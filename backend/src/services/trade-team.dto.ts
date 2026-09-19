import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail } from 'class-validator';

/**
 * Keep boolean fields as `unknown` at runtime so Nest's global
 * enableImplicitConversion cannot turn the string "false" into boolean true.
 * @IsBoolean then accepts only actual JSON booleans.
 */
export class UpdateTradeTeamPermissionsDto {
    @ApiProperty({ format: 'email' })
    @IsEmail()
    email!: string;

    @ApiProperty({ type: Boolean })
    @IsBoolean()
    deliveryEnabled!: unknown;

    @ApiProperty({ type: Boolean })
    @IsBoolean()
    inspectionEnabled!: unknown;

    @ApiProperty({ type: Boolean, description: 'May view TradeXchange job feeds, assigned jobs and job transcripts.' })
    @IsBoolean()
    canView!: unknown;

    @ApiProperty({ type: Boolean, description: 'May use the paid service-job customer chat.' })
    @IsBoolean()
    canChat!: unknown;

    @ApiProperty({ type: Boolean, description: 'May create, amend or withdraw quotes for the business.' })
    @IsBoolean()
    canQuote!: unknown;

    @ApiProperty({ type: Boolean, description: 'May start and operationally manage an assigned job.' })
    @IsBoolean()
    canManage!: unknown;

    @ApiProperty({ type: Boolean, description: 'May mark an in-progress job complete.' })
    @IsBoolean()
    canComplete!: unknown;
}

export type TradeTeamPermissionInput = {
    email: string;
    deliveryEnabled: boolean;
    inspectionEnabled: boolean;
    canView: boolean;
    canChat: boolean;
    canQuote: boolean;
    canManage: boolean;
    canComplete: boolean;
};
