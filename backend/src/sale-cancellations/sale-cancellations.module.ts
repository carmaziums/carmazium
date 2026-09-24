import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { SaleCancellationsController } from './sale-cancellations.controller';
import { SaleCancellationsService } from './sale-cancellations.service';
import { SaleCancellationEvidenceService } from './sale-cancellation-evidence.service';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        PaymentsModule,
        AuctionsModule,
    ],
    controllers: [SaleCancellationsController],
    providers: [SaleCancellationsService, SaleCancellationEvidenceService],
    exports: [SaleCancellationsService],
})
export class SaleCancellationsModule {}
