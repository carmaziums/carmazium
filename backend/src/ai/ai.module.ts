import { MaziumSessionGuard } from './mazium-session.guard';
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MaziumSupportAutoReplyService } from './mazium-support-auto-reply.service';
import { MaziumSupportDispatcher } from './mazium-support-dispatcher.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { TourNarrationController } from './tour-narration.controller';
import { TourNarrationService } from './tour-narration.service';

@Module({
    imports: [AuthModule, PrismaModule, ChatModule],
    controllers: [AiController, TourNarrationController],
    providers: [MaziumSessionGuard, AiService, MaziumSupportAutoReplyService, MaziumSupportDispatcher, TourNarrationService],
    exports: [AiService, MaziumSupportAutoReplyService],
})
export class AiModule { }
