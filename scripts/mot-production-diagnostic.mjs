// Read-only upstream checks inside the existing production machine.
// Secrets stay on that machine. Only allowlisted status fields reach public CI logs.
const app = 'carmazium-hjoh9w';
// Independent network check from the CI runner; no credentials are sent.
try {
  const response = await fetch('https://history.mot.api.gov.uk/', { signal: AbortSignal.timeout(10000) });
  console.log(JSON.stringify({ runnerConnection: 'HTTP_' + response.status }));
} catch (error) {
  const code = error?.cause?.code;
  console.log(JSON.stringify({ runnerConnection: typeof code === 'string' && /^(ERR_(SSL|TLS)_|UND_ERR_|E)[A-Z0-9_]{1,55}$/.test(code) ? code : 'connection_failed' }));
}
const token = process.env.FLY_API_TOKEN;
if (!token) throw new Error('Existing Fly access is not configured');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function api(path, body) {
  const r = await fetch(`https://api.machines.dev/v1/apps/${app}/machines${path}`, {
    headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok) throw new Error(`Fly diagnostic HTTP ${r.status}`);
  return r.json();
}
const machines = await api('?include_deleted=false');
const machine = machines.find(m => m.state === 'started');
if (!machine || !/^[a-z0-9]+$/.test(machine.id)) throw new Error('No running machine');
const probe = async () => {
  const out = { stage: 'configuration' };
  const emit = () => process.stdout.write(JSON.stringify(out));
  try {
    const env = process.env;
    out.configured = ['MOT_HISTORY_API_KEY','MOT_HISTORY_CLIENT_ID','MOT_HISTORY_CLIENT_SECRET','MOT_HISTORY_TOKEN_URL'].every(k => Boolean(env[k]));
    if (!out.configured) return emit();
    const u = new URL(env.MOT_HISTORY_TOKEN_URL);
    if (u.protocol !== 'https:' || u.hostname !== 'login.microsoftonline.com' || !/^\/[^/]+\/oauth2\/v2\.0\/token$/.test(u.pathname) || u.username || u.password || u.search || u.hash) return emit();
    out.stage = 'token';
    const r = await fetch(u, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:AbortSignal.timeout(12000), body:new URLSearchParams({grant_type:'client_credentials',client_id:env.MOT_HISTORY_CLIENT_ID,client_secret:env.MOT_HISTORY_CLIENT_SECRET,scope:env.MOT_HISTORY_SCOPE || 'https://tapi.dvsa.gov.uk/.default'}) });
    out.tokenStatus = r.status;
    const b = await r.json();
    if (!r.ok || typeof b.access_token !== 'string') { out.tokenError = ['invalid_client','invalid_scope','invalid_grant','unauthorized_client'].includes(b.error) ? b.error : 'other'; return emit(); }
    out.stage = 'vehicle';
    const v = await fetch('https://history.mot.api.gov.uk/v1/trade/vehicles/registration/NX17TWU', {headers:{Authorization:'Bearer '+b.access_token,'X-API-Key':env.MOT_HISTORY_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    out.vehicleStatus = v.status;
    const data = await v.json();
    const code = data.errorCode || data.code;
    out.vehicleCode = /^MOTH-[A-Z]{2}-\d{2}$/.test(code || '') ? code : 'none';
    out.testsArray = Array.isArray(data.motTests);
    out.testsCount = Array.isArray(data.motTests) ? data.motTests.length : 0;
    out.stage = 'complete';
  } catch (e) {
    out.errorType = ['TypeError','SyntaxError','TimeoutError','AbortError'].includes(e?.name) ? e.name : 'other';
    const c = e?.cause?.code || e?.code;
    out.transportCode = ['ENOTFOUND','ECONNRESET','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR','UND_ERR_HEADERS_TIMEOUT','ERR_INVALID_CHAR','UND_ERR_INVALID_ARG'].includes(c) ? c : 'other';
    out.errorCategory = /certificat|self.signed|issuer|verify.*signature/i.test(String(e?.cause?.message)) ? 'certificate' : /header/i.test(String(e?.message)+' '+String(e?.cause?.message)) ? 'header' : 'other';
    if (typeof c === 'string' && /^ERR_(SSL|TLS)_[A-Z0-9_]{1,55}$/.test(c)) out.transportCode = c;
    if (/handshake|ssl|tls/i.test(String(e?.cause?.message))) out.errorCategory = 'tls_handshake';
    if (Array.isArray(e?.cause?.errors)) {
      out.nestedErrors = e.cause.errors.map(x => ['ENETUNREACH','EHOSTUNREACH','ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(x?.code) ? x.code : 'other').slice(0,4).join('_');
    }
    if (out.stage === 'vehicle') {
      const https = require('node:https');
      const probeConnection = options => new Promise(resolve => {
        const req = https.get('https://history.mot.api.gov.uk/v1/trade/vehicles/registration/NX17TWU', { ...options, signal: AbortSignal.timeout(8000) }, res => { res.resume(); resolve('HTTP_' + res.statusCode); });
        req.on('error', err => resolve(/^[A-Z0-9_]{1,65}$/.test(err.code || '') ? err.code : 'other'));
      });
      [out.ipv4, out.tls12] = await Promise.all([probeConnection({family:4}), probeConnection({family:4,minVersion:'TLSv1.2',maxVersion:'TLSv1.2'})]);
    }
  }
  emit();
};
const result = await api(`/${machine.id}/exec`, {command:['node','-e',`(${probe.toString()})()`],timeout:40});
if (result.exit_code !== 0) throw new Error('Remote probe could not complete; raw output suppressed');
let report;
try { report = JSON.parse(result.stdout); } catch { throw new Error('Unexpected diagnostic output suppressed'); }
const clean = {};
for (const key of ['stage','configured','tokenStatus','tokenError','vehicleStatus','vehicleCode','testsArray','testsCount','errorType','transportCode','errorCategory','nestedErrors','ipv4','tls12']) {
  const v = report[key];
  if (typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && /^[A-Za-z0-9_-]{1,70}$/.test(v))) clean[key] = v;
}
console.log(JSON.stringify(clean));
