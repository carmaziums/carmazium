#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
const verifier=fileURLToPath(new URL('./VerifyAndroidAppBundle.java',import.meta.url));
const run=(command,args,cwd)=>{
  const r=spawnSync(command,args,{cwd,encoding:'utf8',timeout:60000,windowsHide:true});
  if(r.error) throw r.error;
  return r;
};
const requireOK=r=>assert.equal(r.status,0,(r.stderr||'')+(r.stdout||''));

test('AAB verification rejects wrong signers, unsigned additions and modified payloads', {timeout:120000}, () => {
  const dir=mkdtempSync(join(tmpdir(),'carmazium-aab-test-'));
  try {
    const payload=join(dir,'payload');
    mkdirSync(join(payload,'base','manifest'),{recursive:true});
    writeFileSync(join(payload,'base','manifest','AndroidManifest.xml'),'fixture manifest');
    writeFileSync(join(payload,'BundleConfig.pb'),'fixture bundle config');
    const unsigned=join(dir,'unsigned.aab');
    requireOK(run('jar',['--create','--file',unsigned,'-C',payload,'.'],dir));
    // Ephemeral test fixture only. This key is never used for application signing.
    const key=join(dir,'fixture.p12');
    requireOK(run('keytool',['-genkeypair','-alias','fixture','-keystore',key,'-storepass','fixture-only-password','-keypass','fixture-only-password','-dname','CN=Ephemeral AAB unit test','-keyalg','RSA','-keysize','2048','-validity','2','-noprompt'],dir));
    const certificate=run('keytool',['-exportcert','-rfc','-alias','fixture','-keystore',key,'-storepass','fixture-only-password'],dir);
    requireOK(certificate);
    const pin=new X509Certificate(certificate.stdout).fingerprint256.replaceAll(':','').toLowerCase();
    const signed=join(dir,'signed.aab');
    copyFileSync(unsigned,signed);
    requireOK(run('jarsigner',['-keystore',key,'-storepass','fixture-only-password','-keypass','fixture-only-password',signed,'fixture'],dir));
    const verify=(file,expected=pin)=>run('java',[verifier,file,expected],dir);
    const valid=verify(signed);
    requireOK(valid);
    assert.equal(JSON.parse(valid.stdout).certificateSha256,pin);
    assert.equal(JSON.parse(valid.stdout).signedPayloadEntries,2);
    assert.notEqual(verify(unsigned).status,0,'Unsigned bundles must fail');
    assert.notEqual(verify(signed,'0'.repeat(64)).status,0,'Wrong retained certificate must fail');
    const injected=join(dir,'injected.aab');
    copyFileSync(signed,injected);
    writeFileSync(join(payload,'untrusted.txt'),'unsigned addition');
    requireOK(run('jar',['--update','--file',injected,'-C',payload,'untrusted.txt'],dir));
    assert.notEqual(verify(injected).status,0,'An unsigned added payload must fail');
    const tampered=join(dir,'tampered.aab');
    copyFileSync(signed,tampered);
    writeFileSync(join(payload,'BundleConfig.pb'),'tampered bundle config');
    requireOK(run('jar',['--update','--file',tampered,'-C',payload,'BundleConfig.pb'],dir));
    assert.notEqual(verify(tampered).status,0,'A modified signed payload must fail');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
