import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [AuthModule, PrismaModule, ChatModule],
    controllers: [AiController],
    providers: [AiService],
    exports: [AiService],
})
export class AiModule { }
