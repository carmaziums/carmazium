#!/usr/bin/env node
/*
 * Read-only Prisma 6 dependency and config regression gate.
 * Does not connect to an actual database or read account/vehicle records.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname,'..');
const lock = JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const graph = lock.packages || {};

assert.equal(pkg.dependencies['@prisma/client'],'6.19.3',
  'Pin Prisma Client to exactly the reviewed Prisma v6 CLI patch');
assert.equal(pkg.devDependencies.prisma,'6.19.3',
  'CLI and Client must stay on identical v6 versions');
assert.deepEqual(pkg.overrides?.['@prisma/config'],
  {'deepmerge-ts':'8.0.2'},
  'Override should be scoped ONLY to the vulnerable Prisma config tree');
assert.equal(graph['']?.dependencies['@prisma/client'],'6.19.3');
assert.equal(graph['']?.devDependencies.prisma,'6.19.3');
for (const key of ['node_modules/prisma','node_modules/@prisma/client',
  'node_modules/@prisma/config']) {
  assert.equal(graph[key]?.version,'6.19.3',
    'Unexpected Prisma family release mismatch at '+key);
}
assert.equal(graph['node_modules/@prisma/config']?.dependencies['effect'],'3.21.0');
assert.equal(graph['node_modules/@prisma/config']?.dependencies['deepmerge-ts'],'7.1.5',
  'Upstream package exact pin has not changed; a scoped override must resolve it safely');
const deepmerge = Object.entries(graph).filter(([key]) =>
  key==='node_modules/deepmerge-ts'||key.endsWith('/node_modules/deepmerge-ts'));
assert.ok(deepmerge.length,'Cannot assert the locked config dependency');
assert.ok(deepmerge.every(([,item]) => item.version==='8.0.2'),
  'Refuse the vulnerable deepmerge-ts release anywhere in the lockfile');
const effects = Object.entries(graph).filter(([key]) =>
  key==='node_modules/effect'||key.endsWith('/node_modules/effect'));
assert.ok(effects.length);
assert.ok(effects.every(([,item]) => Number(item.version.split('.')[1])>=20),
  'Reject Effect AsyncLocalStorage-affected tree');

const cli = require('prisma/package.json');
const client = require('@prisma/client/package.json');
assert.equal(cli.version,'6.19.3');
assert.equal(client.version,'6.19.3');
assert.equal(require('deepmerge-ts/package.json').version,'8.0.2');
assert.equal(require('effect/package.json').version,'3.21.0');

(async()=>{
  const {deepmerge} = await import('deepmerge-ts');
  assert.equal(typeof deepmerge,'function');
  const oldConfig = {
    datasource:{db:{url:{fromEnvVar:'DATABASE_URL'}}},
    generator:{provider:'prisma-client-js'},
    features:['transactions','auctions'],
  };
  const nextConfig = {
    datasource:{db:{shadowDatabaseUrl:{fromEnvVar:'SHADOW_DATABASE_URL'}}},
    features:['dealers'],
  };
  const merged=deepmerge(oldConfig,nextConfig);
  assert.deepEqual(merged.datasource,{
    db:{url:{fromEnvVar:'DATABASE_URL'},
        shadowDatabaseUrl:{fromEnvVar:'SHADOW_DATABASE_URL'}},
  });
  assert.equal(merged.generator.provider,'prisma-client-js');
  assert.deepEqual(oldConfig.datasource,{db:{url:{fromEnvVar:'DATABASE_URL'}}},
    'Config merge must not mutate original configuration');
  // Do not assert merge order of arrays: Prisma's c12 config loader decides
  // that policy. Only assert that normal nested env fields survive.
  const {PrismaClient}=require('@prisma/client');
  assert.equal(typeof PrismaClient,'function');
  const isolated=new PrismaClient();
  await isolated.$disconnect();
  console.log('PRISMA_V6_CLIENT_CLI_CONFIG_SMOKE_PASS: matching 6.19.3, scoped deepmerge 8.0.2, Effect 3.21.0');
})().catch(e=>{console.error('PRISMA_CONFIG_SECURITY_REGRESSION_FAIL '+e.message);process.exitCode=1;});
