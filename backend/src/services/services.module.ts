import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { PaymentsModule } from '../payments/payments.module';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServiceLeadsController } from './service-leads.controller';
import { ServiceLeadsService } from './service-leads.service';
import { AdminServicesController } from './admin-services.controller';
import { ServicesLifecycleService } from './services-lifecycle.service';
import { ContractorGuard } from './guards/contractor.guard';

/**
 * Trade Exchange service marketplace.
 *
 * Delivery/Inspection use PaymentsModule for checkout + Connect payout.
 * Finance/Warranty are matched enquiries handled by ServiceLeadsService and
 * deliberately create no Stripe payment.
 */
@Module({
    imports: [PrismaModule, ConfigModule, AuthModule, NotificationsModule, EmailModule, PaymentsModule],
    controllers: [ServicesController, ServiceLeadsController, AdminServicesController],
    providers: [ServicesService, ServiceLeadsService, ServicesLifecycleService, ContractorGuard],
    exports: [ServicesService, ServiceLeadsService],
})
export class ServicesModule { }
