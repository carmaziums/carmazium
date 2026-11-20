import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'source/backend/package.json'));
const qa=JSON.parse(readFileSync(resolve(root,'private/qa-env.json'),'utf8'));
process.env.DATABASE_URL='postgresql://postgres:'+qa.password+'@127.0.0.1:5544/carmazium_sandbox_utf8';
const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();
const slug='qa-native-homepage-rendering-20261120';
if(process.argv[2]==='cleanup'){const r=await db.blogPost.deleteMany({where:{slug}});console.log(JSON.stringify({localOnly:true,removed:r.count}));}
else {await db.blogPost.upsert({where:{slug},create:{slug,title:'QA: Homepage guide rendering',excerpt:'Synthetic local article used only to verify the native homepage card, readable text and fallback image behaviour.',content:'This local-only fixture is never published on the public website.',status:'PUBLISHED',publishedAt:new Date(),authorName:'CarMazium QA'},update:{}});console.log(JSON.stringify({localOnly:true,seeded:slug}));}
await db.$disconnect();