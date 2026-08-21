import { Module } from '@nestjs/common';
import { HpiService } from './hpi.service';
import { HpiPdfService } from './hpi-pdf.service';
import { HpiController } from './hpi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  // AuthModule supplies SessionAuthGuard's dependencies; EmailModule for
  // delivering buyer-paid report copies; HttpModule is gone along with the
  // OneAutoAPI call it existed for.
  imports: [PrismaModule, AuthModule, EmailModule],
  controllers: [HpiController],
  providers: [HpiService, HpiPdfService],
  exports: [HpiService],
})
export class HpiModule {}
