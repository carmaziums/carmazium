import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { FinanceReferralController } from './finance-referral.controller';
import { FinanceReferralService } from './finance-referral.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule, EmailModule],
    controllers: [FinanceReferralController, FinanceController],
    providers: [FinanceService, FinanceReferralService],
    exports: [FinanceService],
})
export class FinanceModule { }
