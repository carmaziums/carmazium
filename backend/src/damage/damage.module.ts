import { Module } from '@nestjs/common';
import { DamageAnalysisController } from './damage.controller';
import { DamageAnalysisService } from './damage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [DamageAnalysisController],
  providers: [DamageAnalysisService],
  exports: [DamageAnalysisService],
})
export class DamageAnalysisModule {}
