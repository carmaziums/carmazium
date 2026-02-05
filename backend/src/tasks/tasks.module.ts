import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ImageCleanupService } from './image-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        ConfigModule,
    ],
    providers: [ImageCleanupService],
})
export class TasksModule { }
