/* Cross-version password compatibility drill. Synthetic test passwords only.
 * Usage:
 *   BCRYPT_LEGACY_MODULE=/tmp/.../node_modules/bcrypt \
 *   BCRYPT_SYNTHETIC_FIXTURE_PATH=/tmp/.../fixtures.json \
 *     node backend/scripts/verify-bcrypt6-compatibility.cjs generate
 *
 *   BCRYPT_LEGACY_MODULE=/tmp/.../node_modules/bcrypt \
 *   BCRYPT_SYNTHETIC_FIXTURE_PATH=/tmp/.../fixtures.json \
 *     node backend/scripts/verify-bcrypt6-compatibility.cjs verify
 *
 * No real credentials, production database or user-derived hash ever accessed.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const state = process.argv[2];
const fixturePath = process.env.BCRYPT_SYNTHETIC_FIXTURE_PATH;
const legacyPath = process.env.BCRYPT_LEGACY_MODULE;
if (!['generate','verify'].includes(state) || !fixturePath || !legacyPath
  || !path.isAbsolute(fixturePath) || !path.isAbsolute(legacyPath)) {
  console.error('Requires generate|verify and absolute temporary fixture/legacy module paths');
  process.exit(2);
}

const legacy = require(legacyPath);
const legacyVersion = require(path.join(legacyPath, 'package.json')).version;
assert.equal(legacyVersion, '5.1.1', 'Must use precisely the prior native bcrypt version');
const bcrypt = state === 'verify' ? require('bcrypt') : null;
if (bcrypt) {
  assert.equal(require('bcrypt/package.json').version,'6.0.0',
    'The new backend must install bcrypt 6.0.0 exactly');
}

// Test strings created here are public synthetic samples, never customer data.
const samples = [
  ['ordinary', 'Demonstration-only password 2026!'],
  ['unicode', 'Préfixe🙂字Passphrase#2026'],
  ['exactly72Utf8Bytes', 'A'.repeat(72)],
  ['over72Utf8BytesLegacy', 'B'.repeat(75)+'0123!'],
  ['embeddedUnicodeByteLimit', 'Ü'.repeat(36)],
  ['leadingTrailing', '  password with spaces!  '],
];
const intentionalBad = (correct) => 'not-the-password::' + correct.slice(0,8);

async function generate() {
  assert.equal(require('node:buffer').Buffer.byteLength(samples[2][1]),72);
  assert.ok(require('node:buffer').Buffer.byteLength(samples[3][1])>72);
  const entries=[];
  for (const [kind,password] of samples) {
    const cost=kind==='unicode'?12:10;
    const digest=await legacy.hash(password,cost);
    assert.match(digest,/^\$2[ab]\$\d\d\$/);
    assert.equal(legacy.getRounds(digest),cost);
    entries.push({kind,password,digest,cost});
  }
  // Mode 0600, temp folder selected by CI. Files are synthetic but should
  // never become fixtures with embedded real user credentials.
  fs.writeFileSync(fixturePath,JSON.stringify({
    testOnly:true,library:'bcrypt',libraryVersion:legacyVersion,entries,
  },null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('BCRYPT5_SYNTHETIC_FIXTURES_CREATED '+entries.length);
}
async function verify() {
  const fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  assert.equal(fixtures.testOnly,true);
  assert.equal(fixtures.libraryVersion,'5.1.1');
  assert.equal(fixtures.entries.length,samples.length);
  for(const [kind, original] of samples) {
    const fixture=fixtures.entries.find(x=>x.kind===kind);
    assert.ok(fixture && fixture.password===original,'Fixture must match synthetic generator');
    assert.equal(await legacy.compare(original,fixture.digest),true);
    assert.equal(await bcrypt.compare(original,fixture.digest),true,
      'New bcrypt must authenticate legacy bcrypt5 user password: '+kind);
    assert.equal(await bcrypt.compare(intentionalBad(original),fixture.digest),false,
      'New bcrypt must still reject invalid legacy password: '+kind);
    assert.equal(bcrypt.getRounds(fixture.digest),fixture.cost);
    const newHash=await bcrypt.hash(original,fixture.cost);
    assert.equal(await bcrypt.compare(original,newHash),true);
    assert.equal(await legacy.compare(original,newHash),true,
      'Reverting security code must not lock users with bcrypt6 hashes out: '+kind);
    assert.equal(await legacy.compare(intentionalBad(original),newHash),false);
    // No automatic customer hash rewrite. Both versions use the same
    // $2b$ format and work with the existing stored hash value.
    assert.match(newHash,/^\$2b\$[0-9]{2}\$/);
    assert.equal(newHash.length,60);
  }
  const classic=fixtures.entries.find(x=>x.kind==='ordinary');
  const legacy2a='$2a$'+classic.digest.slice(4);
  assert.equal(await legacy.compare(classic.password,legacy2a),true);
  assert.equal(await bcrypt.compare(classic.password,legacy2a),true,
    'Legacy $2a$ hashes must verify without forced password reset');
  assert.equal(await bcrypt.compare('wrong legacy secret',legacy2a),false);
  // Existing bcrypt maximum is 72 bytes, not 72 JS characters. Test this
  // explicitly to prevent claiming unbounded password entropy.
  const long=fixtures.entries.find(x=>x.kind==='over72Utf8BytesLegacy');
  assert.equal(await bcrypt.compare('B'.repeat(72),long.digest),true);
  assert.equal(await legacy.compare('B'.repeat(72),long.digest),true);
  console.log('BCRYPT_V5_V6_FORWARD_AND_ROLLBACK_COMPATIBILITY_PASS '+samples.length
    +' synthetic hash families + legacy $2a$ + 72-byte legacy boundary');
}
(state==='generate'?generate():verify()).catch((e)=>{
  console.error('BCRYPT_MIGRATION_FAIL '+e.message);
  process.exitCode=1;
});
