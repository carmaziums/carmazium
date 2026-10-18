import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleDmsController } from './simpledms.controller';
import { SimpleDmsGuard } from './simpledms.guard';
import { SimpleDmsService } from './simpledms.service';
import { SimpleDmsReferralController } from './simpledms-referral.controller';
import { SimpleDmsReferralService } from './simpledms-referral.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SimpleDmsController, SimpleDmsReferralController],
  providers: [SimpleDmsGuard, SimpleDmsService, SimpleDmsReferralService],
})
export class SimpleDmsModule {}
