import { Module } from '@nestjs/common';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [PrismaModule, AuthModule, EmailModule],
    controllers: [DealersController],
    providers: [DealersService],
    exports: [DealersService],
})
export class DealersModule {}

