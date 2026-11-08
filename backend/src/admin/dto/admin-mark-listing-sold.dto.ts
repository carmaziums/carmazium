import { IsIn, IsString, Length } from 'class-validator';

export class AdminMarkListingSoldDto {
    @IsIn(['EXTERNAL', 'UNKNOWN'])
    source: 'EXTERNAL' | 'UNKNOWN';

    @IsString()
    @Length(10, 1000)
    reason: string;
}
