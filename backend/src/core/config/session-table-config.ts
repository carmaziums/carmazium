/**
 * A restricted PostgreSQL runtime login must not create schema objects.
 * Only disable connect-pg-simple's DDL when the sessions table, DML grants
 * and RLS rules have already been provisioned and tested in staging.
 * The default preserves the legacy production behaviour.
 */
export function shouldCreateSessionTable(
  env: { SESSION_TABLE_PREPROVISIONED?: string } = process.env,
): boolean {
  return env.SESSION_TABLE_PREPROVISIONED !== 'true';
}
