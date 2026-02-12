import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
    constructor(private readonly prisma: PrismaService) { }

    async createPaymentIntent(amount: number, currency = 'usd') {
        // Stripe Stub
        return {
            clientSecret: `pi_mock_${Date.now()}_secret_mock`,
            amount,
            currency,
            status: 'requires_payment_method',
        };
    }

    async getPaymentHistory(userId: string) {
        return this.prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async handleWebhook(event: any) {
        // Mock webhook handler
        console.log('Received Stripe Webhook:', event.type);
        return { received: true };
    }
}
