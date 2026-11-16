import { BadRequestException } from '@nestjs/common';

export type BankDetailsPatch = {
    bankAccountName?: string;
    bankSortCode?: string;
    bankAccountNumber?: string;
    payoutPreference?: string;
};

// Format validation only: this does not verify account ownership or send money.
export function normalizeBankDetails(input: BankDetailsPatch): BankDetailsPatch {
    const result: BankDetailsPatch = {};
    for (const key of ['bankAccountName', 'bankSortCode', 'bankAccountNumber', 'payoutPreference'] as const) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== 'string') throw new BadRequestException('Bank details must be text.');
        const value = input[key].trim();
        if (key === 'bankAccountName') {
            if (!value || value.length > 100) throw new BadRequestException('Enter the account holder name (up to 100 characters).');
            result[key] = value;
        } else if (key === 'bankSortCode') {
            const digits = value.replace(/[\s-]/g, '');
            if (!/^\d{6}$/.test(digits)) throw new BadRequestException('Enter a 6-digit UK sort code.');
            result[key] = digits;
        } else if (key === 'bankAccountNumber') {
            const digits = value.replace(/\s/g, '');
            if (!/^\d{8}$/.test(digits)) throw new BadRequestException('Enter an 8-digit UK account number.');
            result[key] = digits;
        } else {
            if (value !== 'BANK' && value !== 'STRIPE') throw new BadRequestException('Choose BANK or STRIPE for payouts.');
            result[key] = value;
        }
    }
    return result;
}
