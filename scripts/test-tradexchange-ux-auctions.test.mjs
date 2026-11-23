import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const page=read('src/app/auctions/how-it-works/page.tsx');
const layout=read('src/app/auctions/how-it-works/layout.tsx');
const guide=read('src/components/auctions/HowAuctionsWork.tsx');
const won=read('src/app/auctions/won/[id]/page.tsx');
test('auction guide exposes both role journeys at the established indexable URL',()=>{
 assert.match(page,/href="#for-sellers"/);assert.match(page,/href="#for-dealers"/);
 assert.match(guide,/id="for-sellers"/);assert.match(guide,/id="for-dealers"/);
 assert.match(guide,/href="\/sell\?sellMode=auction#sell-options"/);
 assert.match(guide,/href="\/auctions\/browse"/);assert.match(guide,/href="\/search"/);
 assert.match(layout,/canonical: "\/auctions\/how-it-works"/);
 assert.doesNotMatch(guide,/^"use client"|useState\(|AnimatePresence/);
});
test('auction explanation matches existing sale and payment conditions',()=>{
 for(const text of ['£125','£100','72-hour','24-hour','requires seller acceptance','earlier of 24 hours','adds 3 minutes','below-reserve','pays you for the vehicle','approved handover photo'])assert.ok(guide.includes(text),text);
 assert.match(guide,/not an instant win/);assert.match(guide,/waived fee has no cash refund/);
 const general=read('src/app/how-it-works/page.tsx');
 assert.match(general,/adds 3 minutes to the closing time/);
 assert.doesNotMatch(general,/Resets to 3:00/);
});
test('won auction preserves buyer fee gate and uses original linked services only when eligible',()=>{
 assert.match(won,/!a\.buyerFeePaid/);assert.match(won,/!auction\.buyerRefusedAt/);
 assert.match(won,/inspectionServiceEnabled && !auction\.sellerBonusReleased/);
 assert.match(won,/<ArrangeInspection auctionId=\{auction\.id\} \/>/);
 assert.match(won,/<ArrangeDelivery auctionId=\{auction\.id\} \/>/);
 assert.match(won,/href="\/dashboard\/dealer\/purchases"/);
 assert.match(won,/approved waiver has no cash refund/);
 assert.match(read('src/components/services/ArrangeDelivery.tsx'),/jobPostcodeValid\(postcode\)/);
 assert.match(read('src/components/services/ArrangeInspection.tsx'),/createInspectionFromAuction\(\{ auctionId \}\)/);
});
test('native auction guide uses the shared content and both existing role entry points',()=>{
 const native=read('carmazium app/carmazium app/src/screens/main/HowItWorksScreen.tsx');
 const data=JSON.parse(read('carmazium app/carmazium app/src/data/marketplaceGuides.json'));
 assert.match(native,/guides\.auction\.SELLER_STEPS/);assert.match(native,/guides\.auction\.BUYER_STEPS/);
 assert.match(native,/Start free auction listing/);assert.match(native,/Browse dealer auctions/);
 assert.ok(data.auction.BUYER_STEPS.some(x=>x.desc.includes('not an instant win')));
 assert.ok(data.auction.FAQS.some(x=>x.a.includes('waived fee has no cash refund')));
});
