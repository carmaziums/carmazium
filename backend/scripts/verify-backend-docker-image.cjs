#!/usr/bin/env node
/**
 * Exact final Docker image runtime preflight. Run with NO NETWORK and NO DB
 * credentials: docker run --rm --network none --entrypoint node IMAGE
 * scripts/verify-backend-docker-image.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const expectedAbsences=[
  '@nestjs/cli','@nestjs/schematics','@swc/cli',
  '@xhmikosr/bin-wrapper','@xhmikosr/downloader'
];
for(const name of expectedAbsences){
  const physical=path.join(root,'node_modules',...name.split('/'));
  assert.ok(!fs.existsSync(physical),
    'Unnecessary build-only dependency physically present in final image: '+name);
}
assert.ok(fs.statSync(path.join(root,'dist/main.js')).size>0);
assert.equal(require('bcrypt/package.json').version,'6.0.0');
assert.equal(require('@prisma/client/package.json').version,'6.19.3');
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcrypt');

(async()=>{
  const secret='public synthetic Docker test only; never a customer password';
  const digest=await bcrypt.hash(secret,10);
  assert.equal(await bcrypt.compare(secret,digest),true);
  assert.equal(await bcrypt.compare('incorrect synthetic password',digest),false);
  const client=new PrismaClient();
  await client.$disconnect();
  const modules=fs.readdirSync(path.join(root,'node_modules/@prisma'))
    .filter(name=>fs.statSync(path.join(root,'node_modules/@prisma',name)).isDirectory())
    .sort();
  console.log('PHYSICALLY_COPIED_BUILDER_PRISMA_MODULES '+JSON.stringify(modules));
  console.log('DOCKER_RUNTIME_NATIVE_AUTH_AND_PRISMA_CLIENT_PASS');
  console.log('DOCKER_PHYSICAL_BUILD_TOOL_ABSENCE_PASS '+JSON.stringify(expectedAbsences));
})().catch(e=>{
  console.error('DOCKER_IMAGE_PREFLIGHT_FAIL '+e.message);
  process.exitCode=1;
});
