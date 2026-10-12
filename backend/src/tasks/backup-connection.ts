/**
 * Convert an approved PostgreSQL URI into supported libpq environment
 * parameters. Never pass connection URLs (including passwords) as pg_dump
 * command-line arguments or put unrelated application secrets in its env.
 *
 * This helper supports ordinary single-host PostgreSQL URLs. Unsupported
 * options fail closed rather than silently changing SSL/target routing.
 */
export function backupPgEnvironment(
  uri: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('BACKUP_URI_INVALID');
  }
  if (
    !['postgresql:', 'postgres:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.pathname ||
    parsed.pathname === '/' ||
    !parsed.username ||
    !parsed.password
  ) {
    throw new Error('BACKUP_URI_INVALID');
  }

  const env: NodeJS.ProcessEnv = {
    PATH: baseEnv.PATH,
    HOME: baseEnv.HOME,
    LANG: baseEnv.LANG,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
  };

  // Preserve existing SSL environment defaults only when URI parameters
  // do not override them. Never silently accept arbitrary URL options.
  const inherited = [
    'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY',
    'PGTARGETSESSIONATTRS', 'PGCHANNELBINDING',
  ];
  for (const name of inherited) {
    if (baseEnv[name]) env[name] = baseEnv[name];
  }
  const allowed: Record<string, string> = {
    sslmode: 'PGSSLMODE',
    sslrootcert: 'PGSSLROOTCERT',
    sslcert: 'PGSSLCERT',
    sslkey: 'PGSSLKEY',
    target_session_attrs: 'PGTARGETSESSIONATTRS',
    connect_timeout: 'PGCONNECT_TIMEOUT',
    channel_binding: 'PGCHANNELBINDING',
    application_name: 'PGAPPNAME',
    options: 'PGOPTIONS',
  };
  const seen = new Set<string>();
  for (const [key, value] of parsed.searchParams) {
    if (!allowed[key] || seen.has(key)) {
      throw new Error('BACKUP_URI_OPTIONS_UNSUPPORTED');
    }
    seen.add(key);
    env[allowed[key]] = value;
  }
  return env;
}
