import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleDmsController } from './simpledms.controller';
import { SimpleDmsGuard } from './simpledms.guard';
import { SimpleDmsService } from './simpledms.service';

@Module({
  imports: [PrismaModule],
  controllers: [SimpleDmsController],
  providers: [SimpleDmsGuard, SimpleDmsService],
})
export class SimpleDmsModule {}
