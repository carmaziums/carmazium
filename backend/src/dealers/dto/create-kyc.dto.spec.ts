import { validateSync } from 'class-validator';
import { CreateKycDto } from './create-kyc.dto';

describe('CreateKycDto VAT declaration', () => {
    it.each([true, false, undefined])('accepts an optional actual boolean: %s', (vatRegistered) => {
        const dto = Object.assign(new CreateKycDto(), { vatRegistered });
        expect(validateSync(dto).filter(error => error.property === 'vatRegistered')).toHaveLength(0);
    });
    it.each(['false', 'true', 0, 1, {}, []])('rejects a non-boolean declaration: %p', (vatRegistered) => {
        const dto = Object.assign(new CreateKycDto(), { vatRegistered });
        expect(validateSync(dto).some(error => error.property === 'vatRegistered')).toBe(true);
    });
});
