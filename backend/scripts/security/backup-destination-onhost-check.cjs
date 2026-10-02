'use strict';
/** One-time metadata-only check on the EXISTING running Fly machine.
 * Never emit raw URLs, project IDs from unknown destinations, keys or values.
 */
const {existsSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
function configuredTarget() {
  const raw=process.env.SUPABASE_URL;
  if(!raw)return 'not-configured';
  let host;
  try {host=new URL(raw).hostname.toLowerCase();}catch{return 'invalid-url';}
  if(host==='bwtnzmevjlowwronylxm.supabase.co')return 'inspected-live-supabase-project';
  if(host==='ffkqnswgfdgpsrhnjrqu.supabase.co')return 'separate-development-project';
  return host.endsWith('.supabase.co')?'different-supabase-project':'custom-or-other-destination';
}
let dumpVersion='unavailable';
try{
 const result=execFileSync('pg_dump',['--version'],{
  timeout:4000,encoding:'utf8',stdio:['ignore','pipe','ignore'],env:{PATH:process.env.PATH}
 }).trim();
 const m=result.match(/^pg_dump \(PostgreSQL\) (\d+)(?:\.\d+)?/);
 dumpVersion=m?'PostgreSQL-major-'+m[1]:'unrecognised-version';
}catch{dumpVersion='unavailable';}
console.log(JSON.stringify({
 inspection:'read-only-deployed-backup-config',
 target_class:configuredTarget(),
 storage_service_key_present:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
 database_connection_configured:Boolean(process.env.DATABASE_URL),
 separate_backup_connection_configured:Boolean(process.env.BACKUP_DATABASE_URL),
 require_separate_backup_role:process.env.REQUIRE_SEPARATE_BACKUP_ROLE==='true',
 backup_service_compiled_exists:existsSync('/app/dist/tasks/db-backup.service.js'),
 tasks_module_compiled_exists:existsSync('/app/dist/tasks/tasks.module.js'),
 pg_dump:dumpVersion
}));
