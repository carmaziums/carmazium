import { redactProviderJobBeforePayment } from './services.controller';

describe('TradeXchange provider job privacy', () => {
    const privateJob = (status: string) => ({
        id: 'job-1',
        status,
        pickupPostcode: 'B1 1AA',
        deliveryPostcode: 'B2 2BB',
        pickupAddress: '1 Private Street',
        deliveryAddress: '2 Private Road',
        serviceAddress: '3 Private Avenue',
        customer: {
            id: 'customer-1',
            firstName: 'Alex',
            lastName: 'Private',
            email: 'alex@example.test',
            phone: '07000000000',
        },
    });

    it.each(['OPEN', 'ACCEPTED'])('redacts private customer details while %s', (status) => {
        const result = redactProviderJobBeforePayment(privateJob(status));

        expect(result.customer).toEqual({ id: 'customer-1', firstName: 'Alex' });
        expect(result.pickupAddress).toBeNull();
        expect(result.deliveryAddress).toBeNull();
        expect(result.serviceAddress).toBeNull();
        expect(result.pickupPostcode).toBe('B1 1AA');
        expect(result.deliveryPostcode).toBe('B2 2BB');
    });

    it.each(['PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED', 'DISPUTED'])(
        'keeps authorised private details after successful payment while %s',
        (status) => {
            const job = privateJob(status);
            expect(redactProviderJobBeforePayment(job)).toEqual(job);
        },
    );
});
