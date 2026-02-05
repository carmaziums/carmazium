import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Chat module providing real-time messaging functionality
 * Includes WebSocket Gateway and REST API endpoints
 */
@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const secret = configService.get<string>('SUPABASE_JWT_SECRET');
                // Supabase JWT secret is base64 encoded, decode it for verification
                const secretBuffer = secret ? Buffer.from(secret, 'base64') : undefined;
                return {
                    secret: secretBuffer || secret,
                };
            },
        }),
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
    exports: [ChatService, ChatGateway],
})
export class ChatModule { }
