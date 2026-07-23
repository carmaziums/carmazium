import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { ReceiptPdfService } from './receipt-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [TransactionsController],
    providers: [TransactionsService, ReceiptPdfService],
    exports: [TransactionsService],
})
export class TransactionsModule { }
