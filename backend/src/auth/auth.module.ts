import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
    imports: [PrismaModule],
    controllers: [AuthController],
    providers: [AuthService, SessionAuthGuard, RolesGuard],
    exports: [AuthService, SessionAuthGuard, RolesGuard],
})
export class AuthModule { }
