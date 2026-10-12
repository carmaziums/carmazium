'use strict';

/**
 * Read-only on-host PostgreSQL identity check.
 * Run inside an already authorised CarMazium backend machine/container.
 * Never print DATABASE_URL, DIRECT_URL or a connection error containing a URL.
 */
async function main() {
  const { Client } = require('pg');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not configured in this environment');
    process.exitCode = 2;
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 4000,
    statement_timeout: 4000,
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT current_user AS db_login_role,
             session_user AS db_session_role,
             r.rolbypassrls AS bypasses_rls,
             r.rolcreaterole AS can_create_roles,
             r.rolcreatedb AS can_create_databases,
             has_schema_privilege(current_user, 'public', 'CREATE')
               AS can_create_in_public,
             has_schema_privilege(current_user, 'public', 'USAGE')
               AS can_use_public,
             to_regclass('public.sessions') IS NOT NULL
               AS sessions_table_exists
        FROM pg_roles AS r
       WHERE r.rolname = current_user
    `);
    if (!result.rows || result.rows.length !== 1) {
      throw new Error('Unable to resolve current database login');
    }
    console.log(JSON.stringify({
      inspection: 'read-only; no credentials disclosed',
      ...result.rows[0],
    }, null, 2));
  } catch (error) {
    // A pg error may contain a connection string in its text; never print it.
    const code = error && typeof error.code === 'string'
      ? error.code.replace(/[^A-Za-z0-9_]/g, '')
      : 'unclassified';
    console.error('Read-only database identity inspection failed; code=' + code);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch { /* no secrets in output */ }
  }
}

void main();
