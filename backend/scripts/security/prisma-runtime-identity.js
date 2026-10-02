'use strict';
/**
 * One-off, credentials-safe SELECT via precisely the same Prisma client that
 * the deployed CarMazium backend uses. Do not emit database URLs, query
 * errors, table rows or environment values.
 */
async function main() {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ log: ['error'] });
  try {
    const rows = await db.$queryRaw`
      SELECT current_user::text AS db_login_role,
             session_user::text AS db_session_role,
             r.rolbypassrls AS bypasses_rls,
             r.rolcreaterole AS can_create_roles,
             r.rolcreatedb AS can_create_databases,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
             has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public,
             to_regclass('public.sessions') IS NOT NULL AS sessions_table_exists
        FROM pg_roles r WHERE r.rolname = current_user
    `;
    if (!rows || rows.length !== 1) throw new Error('Unexpected role metadata shape');
    const x=rows[0];
    console.log(JSON.stringify({
      inspection:'read-only using deployed Prisma client',
      db_login_role:x.db_login_role,
      db_session_role:x.db_session_role,
      bypasses_rls:Boolean(x.bypasses_rls),
      can_create_roles:Boolean(x.can_create_roles),
      can_create_databases:Boolean(x.can_create_databases),
      can_create_in_public:Boolean(x.can_create_in_public),
      can_use_public:Boolean(x.can_use_public),
      sessions_table_exists:Boolean(x.sessions_table_exists),
    }));
  } catch (err) {
    const code=(typeof err?.code==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(err.code))
      ?err.code:'UNCLASSIFIED';
    console.error('Read-only Prisma identity check could not complete; code='+code);
    process.exitCode=1;
  } finally {
    try {await db.$disconnect();}catch {/* never print connection metadata */}
  }
}
void main();
