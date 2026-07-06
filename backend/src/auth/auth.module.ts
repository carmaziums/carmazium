import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { OptionalSessionAuthGuard } from './guards/optional-session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
    imports: [PrismaModule, EmailModule],
    controllers: [AuthController],
    providers: [AuthService, SessionAuthGuard, OptionalSessionAuthGuard, RolesGuard],
    exports: [AuthService, SessionAuthGuard, OptionalSessionAuthGuard, RolesGuard],
})
export class AuthModule { }
