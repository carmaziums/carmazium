import { UserRole } from '@prisma/client';

/**
 * Augment the Express session to include our custom fields.
 * This allows TypeScript to recognise req.session.userId etc.
 */
declare module 'express-session' {
    interface SessionData {
        userId: string;
        userRole: UserRole;
    }
}
