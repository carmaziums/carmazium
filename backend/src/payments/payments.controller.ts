import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiCookieAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-intent')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Create payment intent (Stub)' })
    async createIntent(@Body() dto: CreatePaymentIntentDto) {
        const intent = await this.paymentsService.createPaymentIntent(
            dto.amount,
            dto.currency,
        );
        return new StandardResponse(intent);
    }

    @Get('history')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get payment history' })
    async getHistory(@CurrentUser() user: any) {
        const history = await this.paymentsService.getPaymentHistory(user.id);
        return new StandardResponse(history);
    }

    @Post('webhook')
    @ApiOperation({ summary: 'Stripe Webhook Handler (Stub)' })
    async handleWebhook(@Body() event: any) {
        return this.paymentsService.handleWebhook(event);
    }
}
