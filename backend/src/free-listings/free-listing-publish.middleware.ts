import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { FreeListingEntitlementService } from './free-listing-entitlement.service';

@Injectable()
export class FreeListingPublishMiddleware implements NestMiddleware {
    private readonly logger = new Logger(FreeListingPublishMiddleware.name);

    constructor(
        private readonly freeListings: FreeListingEntitlementService,
        private readonly authService: AuthService,
    ) { }

    async use(req: Request, _res: Response, next: NextFunction) {
        try {
            let userId = (req.session as any)?.userId as string | undefined;

            // Mobile/native clients may arrive with a Supabase bearer token and
            // no cookie session yet. Resolve it the same way SessionAuthGuard does.
            if (!userId) {
                const authHeader = req.headers.authorization;
                if (authHeader?.startsWith('Bearer ')) {
                    const user = await this.authService.verifySupabaseToken(authHeader.slice(7));
                    userId = user?.id;
                }
            }

            if (userId) {
                const match = req.path.match(/^\/listings\/([^/]+)\/publish\/?$/);
                const listingId = match?.[1] ? decodeURIComponent(match[1]) : undefined;
                if (listingId) {
                    await this.freeListings.prepareFreePublish(listingId, userId);
                }
            }
        } catch (error: any) {
            // A grant lookup must never break the existing paid publishing path.
            // Fail closed: log it, then let the normal controller/service decide.
            this.logger.warn(`Free-listing entitlement check failed: ${error?.message || error}`);
        }
        next();
    }
}
