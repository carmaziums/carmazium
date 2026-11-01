import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MaziumSupportAutoReplyService } from './mazium-support-auto-reply.service';
import { MaziumSupportDispatcher } from './mazium-support-dispatcher.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [AuthModule, PrismaModule, ChatModule],
    controllers: [AiController],
    providers: [AiService, MaziumSupportAutoReplyService, MaziumSupportDispatcher],
    exports: [AiService, MaziumSupportAutoReplyService],
})
export class AiModule { }
