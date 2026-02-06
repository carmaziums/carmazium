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
                const isBase64 = secret?.includes('/') || secret?.includes('+') || secret?.endsWith('=');

                console.log('ChatModule JWT Init:', {
                    hasSecret: !!secret,
                    length: secret?.length,
                    isProbablyBase64: isBase64
                });

                return {
                    secret: secret && isBase64 ? Buffer.from(secret, 'base64') : secret,
                    verifyOptions: {
                        algorithms: ['HS256'],
                    },
                };
            },
        }),
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
    exports: [ChatService, ChatGateway],
})
export class ChatModule { }
