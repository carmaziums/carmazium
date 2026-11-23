import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const exists=p=>fs.existsSync(new URL('../'+p,import.meta.url));
test('one canonical public hub, with exact permanent legacy redirect',()=>{
  assert.ok(exists('src/app/auctions/page.tsx'));
  assert.ok(!exists('src/app/services/page.tsx'));
  assert.ok(!exists('src/app/services/layout.tsx'));
  assert.ok(!exists('src/app/services/jobs/new/page.tsx'));
  assert.match(read('next.config.ts'),/source: '\/services\/jobs\/new', destination: '\/auctions#request-services', permanent: true/);
  assert.match(read('next.config.ts'),/source: '\/services', destination: '\/auctions', permanent: true/);
  assert.doesNotMatch(read('next.config.ts'),/source: '\/services\/:[^']+'/);
  assert.match(read('src/app/auctions/layout.tsx'),/canonical: "\/auctions"/);
  assert.match(read('src/app/auctions/page.tsx'),/type="CollectionPage"/);
});
test('sitemap and breadcrumbs target canonical URLs directly',()=>{
  const sitemap=read('src/app/sitemap.ts');
  assert.doesNotMatch(sitemap,/"\/services",/);
  assert.match(sitemap,/"\/auctions",/);
  for(const area of ['delivery','inspection','finance','warranty']){
    assert.ok(exists('src/app/services/'+area+'/page.tsx'));
    assert.ok(sitemap.includes('"/services/'+area+'"'));
    const layout=read('src/app/services/'+area+'/layout.tsx');
    assert.ok(layout.includes('canonical: "/services/'+area+'"'));
    assert.match(layout,/label: "TradeXchange", path: "\/auctions"/);
  }
  assert.doesNotMatch(read('src/components/layout/Footer.tsx'),/href="\/services"/);
});
test('private jobs, leads, payment return destinations and native compatibility stay intact',()=>{
  for(const path of ['delivery/new','inspection/new','jobs','jobs/[id]','leads','leads/[id]','warranty/order','warranty/terms']) assert.ok(exists('src/app/services/'+path+'/page.tsx'),path);
  for(const path of ['jobs','leads'])assert.match(read('src/app/services/'+path+'/layout.tsx'),/index: false/);
  const native=read('carmazium app/carmazium app/src/lib/nativeContentLinks.ts');
  assert.match(native,/'\/auctions': 'Services'/);
  assert.match(native,/'\/services': 'Services'/);
  assert.match(read('backend/src/services/services.service.ts'),/\/services\/jobs\/\$\{jobId\}\?paid=1/);
});
test('public navigation and support use the canonical hub without duplicating customer pages',()=>{
 for(const path of ['src/app/about/page.tsx','src/app/page.tsx','src/app/services/finance/page.tsx','src/app/services/jobs/page.tsx','src/app/services/leads/page.tsx','src/components/services/ServiceTemporarilyUnavailable.tsx']) {
  const source=read(path);assert.doesNotMatch(source,/href="\/services"/,path);assert.match(source,/href="\/auctions"/,path);
 }
 assert.doesNotMatch(read('backend/src/ai/mazium-platform-knowledge.ts'),/src\/app\/services\/page\.tsx/);
 assert.match(read('backend/src/ai/mazium-platform-knowledge.ts'),/refer to \/auctions for actual availability/);
});
test('admin tour keeps relative module path and accurate insurance requirements',()=>{
 for(const path of ['src/lib/guidedWebsiteTour.ts','carmazium app/carmazium app/src/lib/guidedTourContent.ts']){
  const source=read(path);
  assert.match(source,/"Service jobs and providers", "\/services", "[^"]+Motor Trade and Public Liability Insurance; inspection requires Public Liability Insurance/);
  assert.doesNotMatch(source,/"Service jobs and providers", "\/dashboard\/admin\/services"/);
 }
});
