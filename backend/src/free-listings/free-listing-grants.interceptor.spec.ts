import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { FreeListingGrantInterceptor } from './free-listing-grants.interceptor';

describe('FreeListingGrantInterceptor', () => {
    const next: CallHandler = { handle: jest.fn(() => of('ok')) } as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function context(controllerName: string, handlerName: string, request: any): ExecutionContext {
        return {
            getClass: () => ({ name: controllerName } as any),
            getHandler: () => ({ name: handlerName } as any),
            switchToHttp: () => ({ getRequest: () => request } as any),
        } as any;
    }

    it('applies an eligible grant immediately before ListingsController.publishListing', async () => {
        const grants = { applyToListingIfEligible: jest.fn().mockResolvedValue(true) };
        const interceptor = new FreeListingGrantInterceptor(grants as any);
        const ctx = context('ListingsController', 'publishListing', {
            user: { id: 'user-1' },
            params: { id: 'listing-1' },
        });

        await interceptor.intercept(ctx, next);

        expect(grants.applyToListingIfEligible).toHaveBeenCalledWith('listing-1', 'user-1');
        expect(next.handle).toHaveBeenCalledTimes(1);
    });

    it('does nothing to any other controller or listing handler', async () => {
        const grants = { applyToListingIfEligible: jest.fn() };
        const interceptor = new FreeListingGrantInterceptor(grants as any);

        await interceptor.intercept(
            context('ListingsController', 'updateStatus', { user: { id: 'user-1' }, params: { id: 'listing-1' } }),
            next,
        );
        await interceptor.intercept(
            context('PaymentsController', 'createListingCheckout', { user: { id: 'user-1' }, params: {} }),
            next,
        );

        expect(grants.applyToListingIfEligible).not.toHaveBeenCalled();
        expect(next.handle).toHaveBeenCalledTimes(2);
    });
});
