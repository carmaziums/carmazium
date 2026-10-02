import { createHash } from 'node:crypto';
import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SimpleDmsGuard } from './simpledms.guard';

const KEY = 'test-key-' + 'x'.repeat(64);
const HASH = createHash('sha256').update(KEY).digest('hex');

function harness(variables: Record<string, string> = {}, presentedKey?: string) {
  const config: any = { get: (name: string) => variables[name] };
  const guard = new SimpleDmsGuard(config);
  const context: any = {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => name === 'x-partner-key' ? presentedKey : undefined,
      }),
    }),
  };
  return { guard, context };
}

describe('SimpleDmsGuard', () => {
  const enabled = {
    PARTNER_API_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_KEY_SHA256: HASH,
  };

  it('fails closed when global feature is disabled', () => {
    const { guard, context } = harness({ ...enabled, PARTNER_API_ENABLED: 'false' }, KEY);
    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('fails closed when this partner is disabled', () => {
    const { guard, context } = harness({ ...enabled, PARTNER_API_SIMPLEDMS_ENABLED: 'false' }, KEY);
    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('refuses to start with no valid stored digest', () => {
    const { guard, context } = harness({ ...enabled, PARTNER_API_SIMPLEDMS_KEY_SHA256: '' }, KEY);
    expect(() => guard.canActivate(context)).toThrow(ServiceUnavailableException);
  });

  it('rejects missing, short and incorrect keys', () => {
    for (const key of [undefined, 'short', 'x'.repeat(64)]) {
      const { guard, context } = harness(enabled, key);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    }
  });

  it('accepts only a matching partner key, including a rotation overlap', () => {
    const { guard, context } = harness({
      ...enabled,
      PARTNER_API_SIMPLEDMS_KEY_SHA256: createHash('sha256').update('other').digest('hex') + ',' + HASH,
    }, KEY);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('ignores session or user login and still requires a partner key', () => {
    const { guard, context } = harness(enabled);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
