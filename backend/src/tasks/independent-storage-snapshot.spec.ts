/* Synthetic-only tests: no Supabase project, remote keys or real objects. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { makePlan, execute, INVENTORY } = require('../../scripts/backup/independent-storage-snapshot.cjs');

const env = {
  CM_OFFSITE_SOURCE_REMOTE: 'synthetic_supabase_s3',
  CM_OFFSITE_CRYPT_REMOTE: 'synthetic_encrypted_offsite',
  CM_OFFSITE_SNAPSHOT: '20261024T200000Z',
};

describe('CarMazium independent Storage recovery preparation', () => {
  it('lists all seven known public and private Storage buckets, including private documents', () => {
    const plan = makePlan(env);
    expect(plan.mode).toBe('plan');
    expect(plan.actions).toHaveLength(14);
    expect(INVENTORY).toEqual(expect.arrayContaining([
      'listings', 'dealer-kyc-documents', 'auction-handover-documents',
    ]));
    expect(plan.actions.every((a: string[]) => !a.includes('sync') && !a.includes('delete'))).toBe(true);
  });

  it('does not execute any transfer by default', () => {
    const exec = jest.fn();
    const log = jest.fn();
    const result = execute(env, exec, log);
    expect(result.executed).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('requires owner, post-pilot release and independent-destination confirmations together', () => {
    const enabled = { ...env, CM_OFFSITE_MODE: 'execute' };
    expect(() => makePlan(enabled)).toThrow('POSTPILOT_RELEASE_NOT_APPROVED');
    enabled.CM_OFFSITE_OWNER_APPROVED = 'true';
    enabled.CM_OFFSITE_POSTPILOT_RELEASE_APPROVED = 'true';
    expect(() => makePlan(enabled)).toThrow('POSTPILOT_RELEASE_NOT_APPROVED');
    enabled.CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED = 'true';
    expect(makePlan(enabled).mode).toBe('execute');
  });

  it('refuses an unencrypted destination and never starts a copy', () => {
    const fake = jest.fn().mockReturnValue({ status: 0, stdout: '[dest]\ntype = s3\n', stderr: '' });
    const cfg = {
      ...env,
      CM_OFFSITE_MODE: 'execute',
      CM_OFFSITE_OWNER_APPROVED: 'true',
      CM_OFFSITE_POSTPILOT_RELEASE_APPROVED: 'true',
      CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED: 'true',
    };
    expect(() => execute(cfg, fake, jest.fn())).toThrow('ENCRYPTED_DESTINATION_NOT_VERIFIED');
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('copies and verifies seven separate bucket snapshots under an encrypted remote', () => {
    const fake = jest.fn().mockImplementation((binary, args) => args[0] === 'config'
      ? { status: 0, stdout: '[dest]\ntype = crypt\n', stderr: '' }
      : { status: 0, stdout: '', stderr: '' });
    const cfg = {
      ...env,
      CM_OFFSITE_MODE: 'execute',
      CM_OFFSITE_OWNER_APPROVED: 'true',
      CM_OFFSITE_POSTPILOT_RELEASE_APPROVED: 'true',
      CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED: 'true',
    };
    const result = execute(cfg, fake, jest.fn());
    expect(result).toMatchObject({ executed: true, bucketCount: 7 });
    expect(fake).toHaveBeenCalledTimes(15);
    expect(fake.mock.calls.filter((c) => c[1][0] === 'copy')).toHaveLength(7);
    expect(fake.mock.calls.filter((c) => c[1][0] === 'check')).toHaveLength(7);
  });

  it('stops immediately on failed copy without exposing subprocess errors', () => {
    const fake = jest.fn()
      .mockReturnValueOnce({ status: 0, stdout: '[dest]\ntype = crypt\n' })
      .mockReturnValueOnce({ status: 1, stderr: 'private/some-sensitive-file' });
    const cfg = {
      ...env,
      CM_OFFSITE_MODE: 'execute',
      CM_OFFSITE_OWNER_APPROVED: 'true',
      CM_OFFSITE_POSTPILOT_RELEASE_APPROVED: 'true',
      CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED: 'true',
    };
    expect(() => execute(cfg, fake, jest.fn())).toThrow('OFFSITE_COPY_FAILED');
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('rejects source and target equality, unsafe names and malicious snapshot paths', () => {
    expect(() => makePlan({ ...env, CM_OFFSITE_CRYPT_REMOTE: env.CM_OFFSITE_SOURCE_REMOTE }))
      .toThrow('DESTINATION_MUST_BE_SEPARATE');
    expect(() => makePlan({ ...env, CM_OFFSITE_SOURCE_REMOTE: 'src:../../etc' }))
      .toThrow('REMOTE_CONFIGURATION_REQUIRED');
    expect(() => makePlan({ ...env, CM_OFFSITE_SNAPSHOT: '../yesterday' }))
      .toThrow('INVALID_SNAPSHOT');
  });
});
