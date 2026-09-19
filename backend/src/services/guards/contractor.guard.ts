import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TradeTeamService } from '../trade-team.service';

/**
 * Lets through an approved direct service provider, or a dealership team member
 * who has explicit TradeXchange permissions granted by the business owner.
 *
 * The resolved actor always carries the business ContractorProfile id. Staff
 * users never become the payout identity; they are only the acting/audit user.
 * Per-job service/action checks remain in the controller/service layer because
 * the guard does not yet know which job is being requested.
 */
@Injectable()
export class ContractorGuard implements CanActivate {
    constructor(private readonly tradeTeam: TradeTeamService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const user = req.user;

        if (!user?.id) throw new ForbiddenException('Not authenticated');
        if (user.role === UserRole.ADMIN) return true;

        const actor = await this.tradeTeam.requireActor(user.id);
        req.tradeActor = actor;
        req.contractorProfileId = actor.contractorProfileId;
        req.approvedServiceTypes = actor.isStaff && !actor.canView ? [] : actor.allowedServiceTypes;
        return true;
    }
}
