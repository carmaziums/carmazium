import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'source/backend/package.json'));
const qa=JSON.parse(readFileSync(resolve(root,'private/qa-env.json'),'utf8')),fixtures=JSON.parse(readFileSync(resolve(root,'private/fixtures.json'),'utf8')),f=JSON.parse(readFileSync(resolve(root,'private/checkout-fixtures.json'),'utf8'));
process.env.DATABASE_URL='postgresql://postgres:'+qa.password+'@127.0.0.1:5544/carmazium_sandbox_utf8';
const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();
const slug='synthetic-qa-native-offer-actions-20261120',nativeId=f.nativeJob.customerId;
if(process.argv[2]==='seed'){
const l=await db.listing.upsert({where:{slug},create:{slug,title:'Synthetic QA offer actions',description:'Local sandbox test only. Not a real vehicle for sale.',sellerId:nativeId,price:7500,images:[],status:'ACTIVE',type:'CLASSIFIED',make:'Synthetic',model:'Offers',year:2020,mileage:50000,fuelType:'PETROL',transmission:'MANUAL',seats:5,engineSize:1200,bodyType:'HATCHBACK',location:'Birmingham'},update:{}});
for(const [name,amount] of [['buyer',7000],['outsider',6500]]){const old=await db.offer.findFirst({where:{listingId:l.id,buyerId:fixtures.users[name].id}});if(!old)await db.offer.create({data:{listingId:l.id,sellerId:nativeId,buyerId:fixtures.users[name].id,amount,initialAmount:amount,status:'PENDING',message:'Local native QA synthetic offer'}})}
console.log(JSON.stringify({localOnly:true,createdFor:'native seller',listingId:l.id}));
}else{
const l=await db.listing.findUnique({where:{slug},select:{id:true,status:true,sale:{select:{soldPrice:true,createdAt:true,purchaseStatus:true}}}});
const offers=l?await db.offer.findMany({where:{listingId:l.id},select:{id:true,status:true,amount:true,sellerCounterAmount:true,buyerCounterAmount:true,finalAmount:true,lastCounteredBy:true}}):[];
console.log(JSON.stringify({localOnly:true,listing:l,offers}));
}await db.$disconnect();