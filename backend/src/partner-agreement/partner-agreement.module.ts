import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerAgreementController } from './partner-agreement.controller';
import { PartnerAgreementGuard } from './partner-agreement.guard';
import { PartnerAgreementService } from './partner-agreement.service';

/**
 * Global so business endpoints can apply the same server-side guard without
 * duplicating owner/signature logic across Auction, Dealer and Service modules.
 */
@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PartnerAgreementController],
  providers: [PartnerAgreementService, PartnerAgreementGuard],
  exports: [PartnerAgreementService, PartnerAgreementGuard],
})
export class PartnerAgreementModule {}
