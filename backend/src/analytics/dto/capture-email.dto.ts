import { IsString, IsEmail } from 'class-validator';

export class CaptureEmailDto {
    @IsEmail()
    email: string;

    @IsString()
    source: string; // auctions_coming_soon, newsletter, mazium_widget
}
