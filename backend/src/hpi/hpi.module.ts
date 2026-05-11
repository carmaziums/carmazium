import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HpiService } from './hpi.service';
import { HpiController } from './hpi.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [HpiController],
  providers: [HpiService],
  exports: [HpiService],
})
export class HpiModule {}
