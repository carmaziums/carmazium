import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
    ApiProduces,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
    constructor(
        private readonly transactionsService: TransactionsService,
        private readonly receiptPdfService: ReceiptPdfService,
    ) { }

    /**
     * Get current user's transactions.
     */
    @Get('my')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get my transactions' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findMyTransactions(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '20');

        const { data, total } = await this.transactionsService.findByUser(
            user.id,
            pageNum,
            limitNum,
        );
        return new PaginatedResponse(data, total, pageNum, limitNum);
    }

    /**
     * Get earnings summary (available, pending, YTD total).
     */
    @Get('stats')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get earnings statistics' })
    async getEarningsStats(@CurrentUser() user: any) {
        const stats = await this.transactionsService.getEarningsStats(user.id);
        return new StandardResponse(stats);
    }

    /**
     * Download a per-transaction receipt as a PDF, rendered onto the Carmazium letterhead.
     * 404 if the transaction doesn't belong to the requester (either as payer or as seller of the linked listing).
     */
    @Get(':id/receipt.pdf')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Download PDF receipt for a transaction' })
    @ApiParam({ name: 'id', description: 'Transaction id' })
    @ApiProduces('application/pdf')
    async downloadReceipt(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        const pdf = await this.receiptPdfService.renderForTransaction(id, user.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carmazium-receipt-${id.slice(0, 8)}.pdf"`);
        res.setHeader('Content-Length', pdf.length.toString());
        res.end(pdf);
    }
}
