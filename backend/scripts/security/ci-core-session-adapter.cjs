'use strict';
/**
 * This script MUST execute only against disposable GitHub Actions PostgreSQL.
 * Exercises the *real* connect-pg-simple adapter using live-shaped synthetic
 * sessions, with no customer data and no production connection strings.
 */
if (process.env.CI_CORE_SCHEMA_REHEARSAL !== 'true' ||
    process.env.PGDATABASE !== 'cm_core_ci' ||
    process.env.PGHOST !== '127.0.0.1') {
  console.error('Refusing to run outside disposable cm_core_ci on localhost');
  process.exit(2);
}
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: 'cm_core_runtime',
  password: 'synthetic_runtime_ci_only',
  port: 5432,
  max: 2,
  connectionTimeoutMillis: 3000,
});
const store = new PgSession({
  pool, schemaName: 'cm_core', tableName: 'sessions',
  createTableIfMissing: false, pruneSessionInterval: false,
});
const call = (method, ...args) => new Promise((resolve, reject) => {
  store[method](...args, (error, result) =>
    error ? reject(error) : resolve(result));
});
async function main() {
  const { rows } = await pool.query(
    "SELECT current_user AS role, NOT has_schema_privilege(current_user,'public','CREATE') AS no_ddl");
  if (rows[0]?.role !== 'cm_core_runtime' || rows[0]?.no_ddl !== true) {
    throw new Error('Session adapter is not using the intended restricted role');
  }
  const sid = 'synthetic-ci-session';
  const now = new Date();
  const fresh = {
    cookie: { originalMaxAge: 3600000, expires: new Date(now.getTime() + 3600000) },
    syntheticRole: 'CI_ONLY',
  };
  await call('set', sid, fresh);
  const loaded = await call('get', sid);
  if (loaded?.syntheticRole !== 'CI_ONLY') throw new Error('Session restore failed');
  await call('touch', sid, {
    ...loaded, cookie: {
      ...loaded.cookie, originalMaxAge: 7200000,
      expires: new Date(now.getTime() + 7200000),
    },
  });
  const afterTouch = await pool.query(
    'SELECT expire FROM cm_core.sessions WHERE sid = $1', [sid]);
  if (new Date(afterTouch.rows[0]?.expire).getTime() <= now.getTime() + 5400000) {
    throw new Error('Session expiry was not extended');
  }
  await call('destroy', sid);
  if ((await call('get', sid)) != null) throw new Error('Session was not destroyed');
  console.log('PASS: real connect-pg-simple set/get/touch/destroy under restricted synthetic login');
}
main().catch(error => {
  // Never print SQL payloads or connection URLs. CI has synthetic secrets only.
  const expectedErrors = [
    'Session restore failed', 'Session expiry was not extended',
    'Session was not destroyed', 'Session adapter is not using the intended restricted role',
  ];
  const ownReason = expectedErrors.includes(error.message) ? '; assertion=' + error.message : '';
  console.error('FAIL: restricted real session adapter; type=' +
    String(error.name || 'unknown').replace(/[^A-Za-z]/g, '') +
    '; code=' + (typeof error.code === 'string' ? error.code : 'UNCLASSIFIED') + ownReason);
  process.exitCode = 1;
}).finally(async () => {
  try { await pool.end(); } catch { process.exitCode = 1; }
});
