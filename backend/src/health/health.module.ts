import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RoutingDrainService } from './routing-drain.service';

@Module({
    imports: [TerminusModule, PrismaModule],
    controllers: [HealthController],
    providers: [RoutingDrainService],
    exports: [RoutingDrainService],
})
export class HealthModule { }
