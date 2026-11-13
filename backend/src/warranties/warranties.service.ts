import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma, WarrantyOrder } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveFrontendUrl } from '../core/frontend-url';
import { calculateWarrantyRetailPrice } from '../services/warranty-retail-tariff';
import { CreateWarrantyQuoteDto, IssueWarrantyDto, WarrantySelectionDto } from './warranty.dto';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const WARRANTY_NOTICE_VERSION = 'warranty-order-2026-11-13';
export const WARRANTY_STATUS_LABELS: Record<string, string> = {
    QUOTED: 'Quote ready', CHECKOUT_PENDING: 'Awaiting payment', PAID_AWAITING_ISSUE: 'Paid — awaiting warranty issue',
    ISSUED: 'Warranty issued', PAYMENT_FAILED: 'Payment unsuccessful', EXPIRED: 'Quote expired',
    REFUND_PENDING: 'Refund in progress', REFUNDED: 'Refunded', PAYMENT_REVIEW: 'Payment needs review',
};

@Injectable()
export class WarrantiesService {
    private readonly logger = new Logger(WarrantiesService.name);
    constructor(private readonly prisma: PrismaService, private readonly payments: PaymentsService,
        private readonly email: EmailService, private readonly notifications: NotificationsService, private readonly config: ConfigService) {}

    price(selection: WarrantySelectionDto) {
        try { return calculateWarrantyRetailPrice(selection); }
        catch (error) { throw new BadRequestException(error.message); }
    }

    async listing(id: string) {
        const listing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null, type: 'CLASSIFIED', status: 'ACTIVE' },
            select: { id: true, title: true, vrm: true, make: true, model: true, fuelType: true, engineSize: true, price: true, mileage: true } });
        if (!listing) throw new NotFoundException('This listing is no longer available. You can still get a quote by entering your vehicle details.');
        return listing;
    }

    async quote(dto: CreateWarrantyQuoteDto, userId?: string) {
        const price = this.price(dto.selection);
        const today = new Date().toISOString().slice(0, 10);
        if (dto.vehicle.firstRegistrationDate > today || dto.vehicle.requestedStartDate < today) {
            throw new BadRequestException('Check the registration date and choose a start date of today or later.');
        }
        if (dto.vehicle.requestedStartDate < dto.vehicle.purchaseDate || dto.vehicle.purchaseDate < dto.vehicle.firstRegistrationDate) {
            throw new BadRequestException('The warranty start must be on or after the purchase date, and purchase cannot precede first registration.');
        }
        if (dto.vehicle.lastServiceDate && dto.vehicle.lastServiceDate > today) throw new BadRequestException('Last service cannot be in the future.');
        if (dto.vehicle.lastServiceMileage !== undefined && dto.vehicle.lastServiceMileage > dto.vehicle.mileage) throw new BadRequestException('Last service mileage cannot exceed the current mileage.');
        if (dto.vehicle.knownFaults === 'KNOWN' && (dto.vehicle.faultDetails?.trim().length ?? 0) < 5) throw new BadRequestException('Describe the known faults.');
        if (dto.customer.phone.replace(/\D/g, '').length < 7 || dto.customer.phone.replace(/\D/g, '').length > 15) throw new BadRequestException('Enter a valid telephone number.');
        if (dto.listingId) {
            const listing = await this.listing(dto.listingId);
            if (listing.vrm && listing.vrm.replace(/\s/g, '').toUpperCase() !== dto.vehicle.vrm) throw new BadRequestException('The registration must match the selected listing. Start a separate quote for another vehicle.');
        }
        const customer = { ...dto.customer, email: dto.customer.email.toLowerCase() };
        const requestHash = hash(JSON.stringify({ customer, vehicle: dto.vehicle, selection: dto.selection, listingId: dto.listingId ?? null, userId: userId ?? null }));
        let order: WarrantyOrder;
        try {
            order = await this.prisma.warrantyOrder.create({ data: {
                id: dto.requestId, userId, listingId: dto.listingId, accessTokenHash: hash(dto.accessToken), requestHash,
                customer: json(customer), vehicle: json(dto.vehicle), selection: json(dto.selection), price: json(price), totalPence: price.totalPence,
                tariffVersion: price.tariffVersion, consentVersion: WARRANTY_NOTICE_VERSION, expiresAt: new Date(Date.now() + 30 * 60_000),
            } });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
            order = await this.access(dto.requestId, dto.accessToken, userId);
            if (order.requestHash !== requestHash) throw new ConflictException('The form changed. Please request a new quote.');
        }
        return this.customerView(order);
    }

    private async access(id: string, token?: string, userId?: string) {
        const order = await this.prisma.warrantyOrder.findUnique({ where: { id } });
        const validToken = order && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) &&
            timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(order.accessTokenHash, 'hex'));
        if (!order || (!validToken && (!userId || order.userId !== userId))) throw new NotFoundException('Warranty order not found. Open it in the browser used for your quote, or sign in to the account used when ordering.');
        return order;
    }

    customerView(order: WarrantyOrder) {
        return { id: order.id, status: order.status, statusLabel: WARRANTY_STATUS_LABELS[order.status], customer: order.customer, vehicle: order.vehicle,
            selection: order.selection, price: order.price, totalPence: order.totalPence, expiresAt: order.expiresAt, checkoutExpiresAt: order.checkoutExpiresAt,
            paidAt: order.paidAt, issuedAt: order.issuedAt, warrantyReference: order.warrantyReference, coverStart: order.coverStart, coverEnd: order.coverEnd, createdAt: order.createdAt };
    }

    async order(id: string, token?: string, userId?: string) {
        let order = await this.access(id, token, userId);
        // Reconcile the actual Stripe session, never a success query parameter.
        if (order.stripeCheckoutSessionId && ['CHECKOUT_PENDING', 'PAYMENT_FAILED', 'EXPIRED'].includes(order.status)) {
            const stripe = await this.payments.getStripeClient();
            await this.reconcileSession(await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId));
            order = await this.access(id, token, userId);
        }
        return this.customerView(order);
    }

    async checkout(id: string, token?: string, userId?: string) {
        const current = await this.access(id, token, userId);
        if (!['QUOTED', 'CHECKOUT_PENDING'].includes(current.status)) throw new ConflictException('This order cannot take another payment. Check its current status.');
        const stripe = await this.payments.getStripeClient();
        if (current.stripeCheckoutSessionId) {
            const session = await stripe.checkout.sessions.retrieve(current.stripeCheckoutSessionId);
            await this.reconcileSession(session);
            if (session.status !== 'open' || !session.url) throw new ConflictException('Checkout has finished or expired. Check your order before requesting another quote.');
            return { url: session.url };
        }
        const account = await stripe.accounts.retrieve();
        const order = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM warranty_orders WHERE id = ${id} FOR UPDATE`;
            const locked = await tx.warrantyOrder.findUniqueOrThrow({ where: { id } });
            if (locked.status === 'QUOTED') {
                if (locked.expiresAt.getTime() <= Date.now()) throw new ConflictException('This quote expired. Please get a new quote.');
                return tx.warrantyOrder.update({ where: { id }, data: { status: 'CHECKOUT_PENDING', stripeAccountId: account.id, checkoutExpiresAt: new Date(Math.floor(Date.now() / 1000) * 1000 + 60 * 60_000) } });
            }
            if (locked.status !== 'CHECKOUT_PENDING' || locked.stripeAccountId !== account.id) throw new ConflictException('Payment configuration or order status changed. Please contact the team with your order reference.');
            return locked;
        });
        if (!order.checkoutExpiresAt || order.checkoutExpiresAt.getTime() <= Date.now() + 30 * 60_000) {
            // An uncertain creation may already have a session: retry with the same
            // idempotency key below while Stripe still accepts the original parameters.
            if (!order.checkoutExpiresAt || order.checkoutExpiresAt.getTime() <= Date.now()) throw new ConflictException('Checkout expired. Please check your order and get a new quote.');
        }
        const base = resolveFrontendUrl(this.config.get('FRONTEND_URL'));
        const customer = order.customer as any;
        const metadata = { type: 'WARRANTY_ORDER', orderId: id, accountId: account.id, tariffVersion: order.tariffVersion };
        const session = await stripe.checkout.sessions.create({
            mode: 'payment', client_reference_id: id, customer_email: customer.email,
            expires_at: Math.floor(order.checkoutExpiresAt!.getTime() / 1000),
            line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: order.totalPence, tax_behavior: 'inclusive',
                product_data: { name: '12-month vehicle warranty — arranged through Pulse Cars Limited', description: 'VAT included. Payment places your order; cover starts only after the warranty is issued and confirmed.' } } }],
            metadata, payment_intent_data: { metadata },
            success_url: `${base}/services/warranty/order?id=${id}`,
            cancel_url: `${base}/services/warranty/order?id=${id}&cancelled=1`,
        }, { idempotencyKey: `warranty-checkout-${id}` });
        await this.prisma.warrantyOrder.updateMany({ where: { id, stripeCheckoutSessionId: null }, data: { stripeCheckoutSessionId: session.id } });
        if (!session.url) throw new ConflictException('Checkout could not be opened. Your quote is saved; please try again.');
        return { url: session.url };
    }

    async reconcileSession(session: any) {
        if (session.metadata?.type !== 'WARRANTY_ORDER' || !session.metadata.orderId) return;
        const id = session.metadata.orderId;
        await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM warranty_orders WHERE id = ${id} FOR UPDATE`;
            const order = await tx.warrantyOrder.findUnique({ where: { id } });
            if (!order) return;
            if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) throw new ConflictException('Warranty checkout reference mismatch.');
            if (session.client_reference_id !== id || session.metadata.accountId !== order.stripeAccountId || session.amount_total !== order.totalPence || session.currency !== order.currency || session.mode !== 'payment' || session.livemode !== !this.payments.isStripeInTestMode()) {
                throw new ConflictException('Warranty payment does not match its saved quote.');
            }
            if (session.payment_status === 'paid' && typeof session.payment_intent === 'string') {
                if (order.paidAt) return; // late/duplicate success must not undo issue/refund/review
                const paid = await tx.warrantyOrder.update({ where: { id }, data: { status: 'PAID_AWAITING_ISSUE', paidAt: new Date(), stripeCheckoutSessionId: session.id, stripePaymentIntentId: session.payment_intent } });
                await this.enqueue(tx, paid, 'PAID');
            } else if (session.status === 'expired' && !order.paidAt) {
                await tx.warrantyOrder.update({ where: { id }, data: { status: 'EXPIRED' } });
            }
        });
    }

    async handleStripeEvent(type: string, object: any) {
        if (type.startsWith('checkout.session.') && object.metadata?.type === 'WARRANTY_ORDER') {
            // Retrieve canonical state even for delayed failure/expiry events.
            const stripe = await this.payments.getStripeClient();
            const session = await stripe.checkout.sessions.retrieve(object.id);
            await this.reconcileSession(session);
            if (type === 'checkout.session.async_payment_failed' && session.payment_status !== 'paid') {
                await this.prisma.warrantyOrder.updateMany({ where: { id: object.metadata.orderId, stripeCheckoutSessionId: object.id, paidAt: null, status: 'CHECKOUT_PENDING' }, data: { status: 'PAYMENT_FAILED' } });
            }
        } else if (type.startsWith('refund.') || type.startsWith('charge.dispute.') || type === 'charge.refunded') {
            const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
            if (!intentId) return;
            const order = await this.prisma.warrantyOrder.findUnique({ where: { stripePaymentIntentId: intentId } });
            if (order) await this.refreshSettlement(order);
        }
    }

    private async refreshSettlement(order: WarrantyOrder) {
        if (!order.stripePaymentIntentId) return;
        const stripe = await this.payments.getStripeClient();
        const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ['latest_charge'] });
        const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge as any : null;
        if (!charge) throw new ConflictException('Could not verify settled payment.');
        let status: string | undefined;
        let reason: string | null = null;
        if (charge.amount_refunded >= order.totalPence) status = 'REFUNDED';
        else if (charge.amount_refunded > 0 || charge.disputed || intent.status !== 'succeeded' || intent.amount_received !== order.totalPence || intent.currency !== order.currency) {
            status = 'PAYMENT_REVIEW'; reason = 'Refund, dispute or payment mismatch — check Stripe before issuing cover.';
        }
        if (status) {
            await this.prisma.$transaction(async tx => {
                await tx.$queryRaw`SELECT id FROM warranty_orders WHERE id = ${order.id} FOR UPDATE`;
                const latest = await tx.warrantyOrder.findUniqueOrThrow({ where: { id: order.id } });
                if (latest.status === status) return;
                const updated = await tx.warrantyOrder.update({ where: { id: order.id }, data: { status, paymentReviewReason: reason } });
                await this.enqueue(tx, updated, status === 'REFUNDED' ? 'REFUNDED' : 'PAYMENT_REVIEW');
            });
        }
    }

    async mine(userId: string) {
        return (await this.prisma.warrantyOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })).map(o => this.customerView(o));
    }

    async adminOrders(status?: string) {
        if (status && !Object.prototype.hasOwnProperty.call(WARRANTY_STATUS_LABELS, status)) throw new BadRequestException('Unknown warranty status.');
        const orders = await this.prisma.warrantyOrder.findMany({ where: status ? { status } : { status: { not: 'QUOTED' } }, orderBy: { createdAt: 'desc' }, take: 200,
            include: { messages: { select: { kind: true, sentAt: true, attempts: true } } } });
        return orders.map(({ accessTokenHash, requestHash, ...order }) => ({ ...order, statusLabel: WARRANTY_STATUS_LABELS[order.status] }));
    }

    async issue(id: string, dto: IssueWarrantyDto, adminId: string) {
        if (dto.coverEnd <= dto.coverStart) throw new BadRequestException('Cover end must be after cover start.');
        const order = await this.prisma.warrantyOrder.findUniqueOrThrow({ where: { id } });
        if (order.status !== 'PAID_AWAITING_ISSUE') throw new ConflictException('Only a paid, unissued order can be marked issued.');
        await this.refreshSettlement(order);
        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM warranty_orders WHERE id = ${id} FOR UPDATE`;
            const updated = await tx.warrantyOrder.updateMany({ where: { id, status: 'PAID_AWAITING_ISSUE', issuedAt: null }, data: {
                status: 'ISSUED', warrantyReference: dto.warrantyReference, coverStart: new Date(dto.coverStart), coverEnd: new Date(dto.coverEnd), issuedBy: adminId, issuedAt: new Date(),
            } });
            if (!updated.count) throw new ConflictException('Order status changed. Refresh before issuing.');
            const issued = await tx.warrantyOrder.findUniqueOrThrow({ where: { id } });
            await this.enqueue(tx, issued, 'ISSUED');
            return this.customerView(issued);
        });
    }

    async refund(id: string, reason: string, adminId: string) {
        const order = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM warranty_orders WHERE id = ${id} FOR UPDATE`;
            const current = await tx.warrantyOrder.findUniqueOrThrow({ where: { id } });
            if (!['PAID_AWAITING_ISSUE', 'REFUND_PENDING'].includes(current.status) || current.issuedAt || !current.stripePaymentIntentId) throw new ConflictException('Only a paid, unissued order can be refunded here. Issued warranties require a cancellation review.');
            if (current.status === 'REFUND_PENDING') return current;
            return tx.warrantyOrder.update({ where: { id }, data: { status: 'REFUND_PENDING', refundReason: reason, refundRequestedBy: adminId } });
        });
        await this.submitRefund(order);
        return { status: (await this.prisma.warrantyOrder.findUniqueOrThrow({ where: { id } })).status };
    }

    private async submitRefund(order: WarrantyOrder) {
        const stripe = await this.payments.getStripeClient();
        const refund = order.stripeRefundId ? await stripe.refunds.retrieve(order.stripeRefundId) : await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId!, amount: order.totalPence, metadata: { type: 'WARRANTY_ORDER', orderId: order.id },
        }, { idempotencyKey: `warranty-refund-${order.id}` });
        await this.prisma.warrantyOrder.update({ where: { id: order.id }, data: { stripeRefundId: refund.id } });
        if (refund.status === 'failed' || refund.status === 'canceled') {
            await this.prisma.warrantyOrder.update({ where: { id: order.id }, data: { status: 'PAYMENT_REVIEW', paymentReviewReason: 'Refund failed. Resolve in Stripe before further action.' } });
        } else await this.refreshSettlement(order);
    }

    private async enqueue(tx: Prisma.TransactionClient, order: WarrantyOrder, kind: string) {
        const customer = order.customer as any, vehicle = order.vehicle as any, selection = order.selection as any;
        const base = resolveFrontendUrl(this.config.get('FRONTEND_URL'));
        const amount = (order.totalPence / 100).toFixed(2);
        const description = kind === 'PAID' ? 'Payment received. Your warranty is awaiting issue. Payment alone does not activate cover. We will confirm the warranty reference and cover dates after it is issued. If we cannot arrange the selected cover, we will contact you and refund the payment.'
            : kind === 'ISSUED' ? `Your warranty has been issued. Reference: ${order.warrantyReference}. Cover: ${order.coverStart?.toISOString().slice(0, 10)} to ${order.coverEnd?.toISOString().slice(0, 10)}. Your warranty documents explain the terms, exclusions and repair authorisation process.`
            : kind === 'REFUNDED' ? 'Your warranty payment has been refunded. Your bank may take several days to show the credit. If a warranty had already been issued, contact the team to confirm its cancellation status.'
            : 'Your warranty payment needs review. The admin team will check the payment and contact you; this is not confirmation of new cover.';
        const body = `<p>${esc(description)}</p><p>Order: ${esc(order.id)}<br>Vehicle: ${esc(vehicle.vrm)} — ${esc(vehicle.make)} ${esc(vehicle.model)}<br>Total paid/quoted: £${amount} including VAT<br>12 months; £${esc(selection.repairLimit)} single repair limit; £${esc(selection.labourRate)}/hour labour.<br>Additions: ${esc(selection.extras.join(', ') || 'None')}</p>`;
        const messages = [{ orderId: order.id, kind: `${kind}_CUSTOMER`, email: customer.email, userId: order.userId, subject: `CarMazium warranty: ${WARRANTY_STATUS_LABELS[order.status]}`, bodyHtml: `${body}<p><a href="${base}/services/warranty/order?id=${order.id}">View your order in the browser used to order, or sign in</a></p>` }];
        const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true, email: true } });
        for (const admin of admins) messages.push({ orderId: order.id, kind: `${kind}_ADMIN`, email: admin.email, userId: admin.id,
            subject: `Warranty order: ${WARRANTY_STATUS_LABELS[order.status]}`,
            bodyHtml: `${body}<p>Customer: ${esc(customer.firstName)} ${esc(customer.lastName)}<br>Email: ${esc(customer.email)}<br>Phone: ${esc(customer.phone)}</p><p><a href="${base}/dashboard/admin/warranty-orders">Open admin warranty orders for the full address, vehicle details and declarations</a></p><p>Arrange and pay the supplier separately. Mark issued only after the matching warranty has actually been issued.</p>` });
        await tx.warrantyOrderMessage.createMany({ data: messages, skipDuplicates: true });
    }

    @Cron('*/30 * * * * *')
    async sendMessages() {
        const pending = await this.prisma.warrantyOrderMessage.findMany({ where: { sentAt: null, nextAttemptAt: { lte: new Date() }, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] }, take: 20, orderBy: { createdAt: 'asc' } });
        for (const message of pending) {
            const claim = await this.prisma.warrantyOrderMessage.updateMany({ where: { id: message.id, sentAt: null, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] }, data: { claimedAt: new Date(), attempts: { increment: 1 } } });
            if (!claim.count) continue;
            try {
                if (message.userId && !await this.prisma.notification.findFirst({ where: { userId: message.userId, entityType: 'WarrantyOrder', entityId: message.orderId, actionType: message.kind } })) {
                    await this.notifications.create({ userId: message.userId, type: 'WARRANTY_ORDER', title: message.subject, message: 'Open your warranty order for details.', entityType: 'WarrantyOrder', entityId: message.orderId, actionType: message.kind,
                        link: message.kind.endsWith('_ADMIN') ? '/dashboard/admin/warranty-orders' : `/services/warranty/order?id=${message.orderId}` });
                }
                if (!await this.email.sendBrandedEmail({ to: message.email, subject: message.subject, bodyHtml: message.bodyHtml })) throw new Error('Email not sent');
                await this.prisma.warrantyOrderMessage.update({ where: { id: message.id }, data: { sentAt: new Date(), claimedAt: null } });
            } catch {
                this.logger.warn(`Warranty message ${message.id} will retry.`);
                await this.prisma.warrantyOrderMessage.update({ where: { id: message.id }, data: { claimedAt: null, nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(message.attempts, 7)) * 1000) } });
            }
        }
    }

    @Cron('0 */5 * * * *')
    async reconcilePending() {
        const orders = await this.prisma.warrantyOrder.findMany({ where: { status: { in: ['CHECKOUT_PENDING', 'REFUND_PENDING'] } }, take: 50, orderBy: { updatedAt: 'asc' } });
        for (const order of orders) {
            try {
                if (order.status === 'REFUND_PENDING') await this.submitRefund(order);
                else if (order.stripeCheckoutSessionId) {
                    const stripe = await this.payments.getStripeClient();
                    await this.reconcileSession(await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId));
                }
            } catch { this.logger.warn(`Warranty order ${order.id} reconciliation will retry.`); }
        }
        await this.prisma.warrantyOrder.updateMany({ where: { status: 'QUOTED', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
        // Unpaid contact details have no ongoing fulfilment purpose.
        await this.prisma.warrantyOrder.deleteMany({ where: { paidAt: null, status: { in: ['QUOTED', 'EXPIRED', 'PAYMENT_FAILED'] }, createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } } });
    }
}
