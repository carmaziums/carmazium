import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageAndroidDirectDownload } from './stage-android-direct-download.mjs';

const cert = 'b'.repeat(64);
const source = 'a'.repeat(40);
const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(4096, 0x42)]);
const sha = createHash('sha256').update(bytes).digest('hex');
const signer = `Verifies\nSigner #1 certificate SHA-256 digest: ${cert}\n`;
const badge = "package: name='uk.carmazium.app' versionCode='42' versionName='1.0.0'\n";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'carmazium-stage-test-'));
  const apkPath = join(root, 'CarMazium-Android-REVIEW-ONLY.apk');
  const evidencePath = join(root, 'release-evidence.json');
  const outputDirectory = join(root, 'private-stage');
  const evidence = {
    evidence_schema: 1, artifact_kind: 'INTERNAL_REVIEW_ONLY', approved_for_customer_download: false,
    apk_filename: 'CarMazium-Android-REVIEW-ONLY.apk', package_name: 'uk.carmazium.app',
    version_code: '42', version_name: '1.0.0', source_sha: source,
    signing_certificate_sha256: cert, apk_sha256: sha, apk_size_bytes: bytes.length,
  };
  writeFileSync(apkPath, bytes);
  writeFileSync(evidencePath, JSON.stringify(evidence));
  const commandRunner = (cmd, args) => {
    if (cmd.endsWith('/apksigner') && args.includes('verify')) return { status: 0, stdout: signer };
    if (cmd.endsWith('/aapt') && args.includes('badging')) return { status: 0, stdout: badge };
    throw Error('Unknown synthetic Android SDK command');
  };
  const options = { apkPath, evidencePath, outputDirectory, ownerPinnedCertificateSha256: cert,
    sdkHome: '/synthetic-sdk', commandRunner };
  return {root, evidence, options, close: () => rmSync(root, {recursive:true,force:true})};
}

test('stages byte-identical, certificate-verified APK privately without any release authority', async () => {
  const f = fixture();
  try {
    const m = await stageAndroidDirectDownload(f.options);
    assert.equal(m.state, 'STAGED_NOT_APPROVED_FOR_PUBLIC_DISTRIBUTION');
    assert.equal(m.customer_release_approved, false);
    assert.equal(m.package_name, 'uk.carmazium.app');
    assert.equal(m.filename, 'CarMazium-1.0.0-v42.apk');
    assert.deepEqual(readFileSync(join(f.options.outputDirectory, m.filename)), bytes);
    assert.deepEqual(JSON.parse(readFileSync(join(f.options.outputDirectory, 'staging-manifest.json'))), m);
    assert.equal(readFileSync(join(f.options.outputDirectory, 'SHA256SUMS.txt'), 'utf8'), `${sha}  ${m.filename}\n`);
    await assert.rejects(stageAndroidDirectDownload(f.options), /already exists/);
  } finally {f.close();}
});

test('rejects wrong independent certificate, modified bytes and manufactured release evidence', async () => {
  const mutations = [
    f => f.options.ownerPinnedCertificateSha256 = 'c'.repeat(64),
    f => writeFileSync(f.options.apkPath, Buffer.alloc(4096, 0x99)),
    f => writeFileSync(f.options.evidencePath, JSON.stringify({...f.evidence, approved_for_customer_download:true})),
    f => writeFileSync(f.options.evidencePath, JSON.stringify({...f.evidence, artifact_kind:'PUBLIC_RELEASE'})),
    f => writeFileSync(f.options.evidencePath, JSON.stringify({...f.evidence, package_name:'uk.carmazium.qa'})),
    f => writeFileSync(f.options.evidencePath, JSON.stringify({...f.evidence, version_name:'../1'})),
    f => writeFileSync(f.options.evidencePath, JSON.stringify({...f.evidence, source_sha:'invalid'})),
  ];
  for (const mutation of mutations) {
    const f=fixture();
    try {mutation(f); await assert.rejects(stageAndroidDirectDownload(f.options)); assert.equal(existsSync(f.options.outputDirectory),false);}
    finally {f.close();}
  }
});

test('rejects wrong signer/package/version and failed Android SDK validation', async () => {
  const cases = [
    () => ({status:0,stdout:`Verifies\nSigner #1 certificate SHA-256 digest: ${'e'.repeat(64)}\n`}),
    () => ({status:0,stdout:signer + `Signer #2 certificate SHA-256 digest: ${'f'.repeat(64)}`}),
  ];
  for (const alteredSigner of cases) {
    const f=fixture();
    try {f.options.commandRunner=(cmd,args)=>cmd.endsWith('/apksigner')?alteredSigner():{status:0,stdout:badge};
      await assert.rejects(stageAndroidDirectDownload(f.options));}
    finally {f.close();}
  }
  for (const bad of [
    "package: name='uk.carmazium.qa' versionCode='42' versionName='1.0.0'\n",
    "package: name='uk.carmazium.app' versionCode='41' versionName='1.0.0'\n",
  ]) {
    const f=fixture();
    try {f.options.commandRunner=(cmd,args)=>cmd.endsWith('/aapt')?{status:0,stdout:bad}:{status:0,stdout:signer};
      await assert.rejects(stageAndroidDirectDownload(f.options));}
    finally {f.close();}
  }
  const f=fixture();
  try {f.options.commandRunner=()=>({status:1,stdout:''}); await assert.rejects(stageAndroidDirectDownload(f.options));}
  finally {f.close();}
});

test('does not follow symlink in place of original review APK or overwrite a staged release', async () => {
  const f=fixture();
  try {
    const other=join(f.root,'actual.apk');
    writeFileSync(other, bytes);
    rmSync(f.options.apkPath);
    symlinkSync(other,f.options.apkPath);
    await assert.rejects(stageAndroidDirectDownload(f.options),/regular file/);
  } finally {f.close();}
});
