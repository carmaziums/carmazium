import { normalizeBankDetails } from './bank-details';

describe('Seller bonus bank details', () => {
    it('normalizes formatting while retaining leading zeroes', () => {
        expect(normalizeBankDetails({ bankAccountName: '  Sample Seller  ', bankSortCode: '01-02-03', bankAccountNumber: '0012 3456' }))
            .toEqual({ bankAccountName: 'Sample Seller', bankSortCode: '010203', bankAccountNumber: '00123456' });
    });
    it.each([
        { bankAccountName: '' }, { bankAccountName: 'a'.repeat(101) },
        { bankSortCode: '12345' }, { bankSortCode: '12x3456' },
        { bankAccountNumber: '1234567' }, { bankAccountNumber: '12x345678' },
        { bankAccountNumber: 12345678 }, { bankSortCode: null },
        { payoutPreference: 'AUTOMATIC' },
    ])('rejects malformed bank details: %j', input => {
        expect(() => normalizeBankDetails(input as any)).toThrow();
    });
    it('does not invent a payout preference or overwrite omitted fields', () => {
        expect(normalizeBankDetails({ bankAccountName: 'Sample Seller' })).toEqual({ bankAccountName: 'Sample Seller' });
    });
});
