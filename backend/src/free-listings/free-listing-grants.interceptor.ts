import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FreeListingGrantsService } from './free-listing-grants.service';

/**
 * Hooks only the existing ListingsController.publishListing handler.
 *
 * The normal publish/payment/review code remains untouched. Immediately before
 * that handler runs, an eligible active admin grant is converted into a normal
 * completed £0 LISTING_FEE transaction. The existing publish code then follows
 * exactly the same path it already uses for a paid BASIC listing.
 */
@Injectable()
export class FreeListingGrantInterceptor implements NestInterceptor {
    constructor(private readonly grants: FreeListingGrantsService) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const controllerName = context.getClass()?.name;
        const handlerName = context.getHandler()?.name;

        if (controllerName !== 'ListingsController' || handlerName !== 'publishListing') {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest<any>();
        const userId = request.user?.id;
        const listingId = request.params?.id;

        if (userId && listingId) {
            await this.grants.applyToListingIfEligible(listingId, userId);
        }

        return next.handle();
    }
}
