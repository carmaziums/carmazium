import { Module } from '@nestjs/common';
import { HpiService } from './hpi.service';
import { HpiPdfService } from './hpi-pdf.service';
import { HpiController } from './hpi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule supplies SessionAuthGuard's dependencies; HttpModule is gone
  // along with the OneAutoAPI call it existed for.
  imports: [PrismaModule, AuthModule],
  controllers: [HpiController],
  providers: [HpiService, HpiPdfService],
  exports: [HpiService],
})
export class HpiModule {}
