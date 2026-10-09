import { backupPgEnvironment } from './backup-connection';

describe('backup libpq environment security', () => {
  it('maps percent-encoded credentials and approved SSL options without retaining unrelated app secrets', () => {
    const env = backupPgEnvironment(
      'postgresql://backup%2Boperator:p%40ss%3Aword@db.example.invalid:6543/synthetic_db?sslmode=verify-full&connect_timeout=5',
      { PATH: '/usr/bin', SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak' },
    );
    expect(env).toMatchObject({
      PGHOST: 'db.example.invalid', PGPORT: '6543',
      PGDATABASE: 'synthetic_db', PGUSER: 'backup+operator',
      PGPASSWORD: 'p@ss:word', PGSSLMODE: 'verify-full',
      PGCONNECT_TIMEOUT: '5', PATH: '/usr/bin',
    });
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.BACKUP_DATABASE_URL).toBeUndefined();
  });

  it('rejects invalid, passwordless and unsupported multi-option URLs', () => {
    expect(() => backupPgEnvironment('not-a-uri')).toThrow('BACKUP_URI_INVALID');
    expect(() => backupPgEnvironment('postgresql://user@db.example.invalid/db')).toThrow('BACKUP_URI_INVALID');
    expect(() => backupPgEnvironment('postgresql://user:pass@db.example.invalid/db?pgbouncer=true'))
      .toThrow('BACKUP_URI_OPTIONS_UNSUPPORTED');
    expect(() => backupPgEnvironment('postgresql://user:pass@db.example.invalid/db?sslmode=require&sslmode=disable'))
      .toThrow('BACKUP_URI_OPTIONS_UNSUPPORTED');
  });

  it('preserves explicit SSL defaults unless the approved URI overrides them', () => {
    const url='postgresql://backup:synthetic@db.example.invalid/db';
    expect(backupPgEnvironment(url, { PGSSLMODE: 'require' }).PGSSLMODE).toBe('require');
    expect(backupPgEnvironment(url+'?sslmode=verify-full', { PGSSLMODE: 'require' }).PGSSLMODE)
      .toBe('verify-full');
  });
});
