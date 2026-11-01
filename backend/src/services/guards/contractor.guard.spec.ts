import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ContractorGuard, EXISTING_SERVICE_WORK_KEY } from './contractor.guard';

describe('TradeXchange existing-work-only re-verification guard', () => {
    const actor = {
        contractorProfileId: 'provider-1',
        allowedServiceTypes: ['INSPECTION'],
        isStaff: false,
        canView: true,
    };

    const setup = (existingWork: boolean) => {
        const tradeTeam: any = { requireActor: jest.fn().mockResolvedValue(actor) };
        const handler = () => undefined;
        if (existingWork) Reflect.defineMetadata(EXISTING_SERVICE_WORK_KEY, true, handler);
        const req: any = { user: { id: 'provider-owner', role: UserRole.DEALER } };
        const context = {
            switchToHttp: () => ({ getRequest: () => req }),
            getHandler: () => handler,
        } as unknown as ExecutionContext;
        return { guard: new ContractorGuard(tradeTeam), tradeTeam, context, req };
    };

    it('does not grant a re-verification exception to new jobs and quotation routes', async () => {
        const { guard, tradeTeam, context } = setup(false);
        expect(await guard.canActivate(context)).toBe(true);
        expect(tradeTeam.requireActor).toHaveBeenCalledWith('provider-owner', false);
    });

    it('allows explicit existing work routes to resolve a provider awaiting re-verification', async () => {
        const { guard, tradeTeam, context, req } = setup(true);
        expect(await guard.canActivate(context)).toBe(true);
        expect(tradeTeam.requireActor).toHaveBeenCalledWith('provider-owner', true);
        expect(req.approvedServiceTypes).toEqual(['INSPECTION']);
    });

    it('continues to forbid access when a business has revoked the actor', async () => {
        const { guard, tradeTeam, context } = setup(true);
        tradeTeam.requireActor.mockRejectedValue(new Error('Not authorised'));
        await expect(guard.canActivate(context)).rejects.toThrow('Not authorised');
    });
});
