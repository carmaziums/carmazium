import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
@Injectable()
export class MaziumSessionGuard extends SessionAuthGuard {
 constructor(auth: AuthService) { super(auth); }
 async canActivate(context: ExecutionContext): Promise<boolean> {
  try { return await super.canActivate(context); }
  catch (error) {
   context.switchToHttp().getRequest().user = undefined;
   if (error instanceof UnauthorizedException) return true;
   throw error;
  }
 }
}
