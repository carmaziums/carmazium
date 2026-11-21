import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PartnerAgreementService } from './partner-agreement.service';

/**
 * Backend enforcement of signed business terms on NEW trade activity.
 * Put after SessionAuthGuard to authenticate before resolving business owner.
 * DO NOT put on refunds, accepted job completion, disputes, payouts or
 * account deletion: unresolved obligations must remain accessible.
 */
@Injectable()
export class PartnerAgreementGuard implements CanActivate {
  constructor(private readonly partnerAgreement: PartnerAgreementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await this.partnerAgreement.assertAccepted(req.user?.id);
    return true;
  }
}
