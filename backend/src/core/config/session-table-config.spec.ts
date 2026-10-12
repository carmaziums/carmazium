import { shouldCreateSessionTable } from './session-table-config';

describe('restricted database-role session bootstrap', () => {
  it('preserves historical create-if-missing behaviour by default', () => {
    expect(shouldCreateSessionTable({})).toBe(true);
    expect(shouldCreateSessionTable({ SESSION_TABLE_PREPROVISIONED: 'false' })).toBe(true);
    expect(shouldCreateSessionTable({ SESSION_TABLE_PREPROVISIONED: 'TRUE' })).toBe(true);
  });

  it('suppresses runtime DDL only after pre-provisioning is deliberately enabled', () => {
    expect(shouldCreateSessionTable({ SESSION_TABLE_PREPROVISIONED: 'true' })).toBe(false);
  });
});
