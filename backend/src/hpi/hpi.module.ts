import { Module } from '@nestjs/common';
import { HpiService } from './hpi.service';
import { HpiPdfService } from './hpi-pdf.service';
import { HpiController } from './hpi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // AuthModule supplies SessionAuthGuard's dependencies; EmailModule for
  // delivering buyer-paid report copies; HttpModule is gone along with the
  // OneAutoAPI call it existed for. NotificationsModule tells the seller the
  // moment a late report is finally attached.
  imports: [PrismaModule, AuthModule, EmailModule, NotificationsModule],
  controllers: [HpiController],
  providers: [HpiService, HpiPdfService],
  exports: [HpiService],
})
export class HpiModule {}
