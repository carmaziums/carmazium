import { Module } from '@nestjs/common';
import { DamageAnalysisController } from './damage.controller';
import { DamageAnalysisService } from './damage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DamageAnalysisController],
  providers: [DamageAnalysisService],
  exports: [DamageAnalysisService],
})
export class DamageAnalysisModule {}
