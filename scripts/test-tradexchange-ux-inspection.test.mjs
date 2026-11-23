import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const landing=read('src/app/services/inspection/page.tsx'), form=read('src/app/services/inspection/new/page.tsx');
const native=read('carmazium app/carmazium app/src/screens/main/CreateServiceJobScreen.tsx');
test('single indexable landing offers four inspection scopes, no public provider feed',()=>{
 for(const k of ['prepurchase','mechanical','cosmetic','stock'])assert.ok(landing.includes('kind: "'+k+'"'));
 assert.match(landing,/href=\{"\/services\/inspection\/new\?kind=" \+ choice.kind\}/);
 assert.match(landing,/Public Liability Insurance/);
 assert.match(landing,/Motor Trade Insurance is not required for inspection-only approval/);
 assert.doesNotMatch(landing,/dashboard\/service\/jobs|Find Jobs/);
 assert.match(read('src/app/services/inspection/layout.tsx'),/canonical: "\/services\/inspection"/);
 assert.match(read('src/app/services/inspection/new/layout.tsx'),/index: false/);
});
test('manual request supports one to twelve vehicles with shared scope and location',()=>{
 assert.match(form,/MAX_VEHICLES = 12/);assert.match(form,/vehicles\.map\(v =>/);
 assert.match(form,/vehicles\.findIndex\(v => !jobVehicleIdentified\(v\)\)/);
 assert.match(form,/vehicles\.findIndex\(v => !jobYearValid\(v.year\)\)/);
 assert.match(form,/notes: v.notes.trim\(\)/);
 assert.match(form,/slice\(0,2000\)/);
 assert.match(form,/parseUkServiceDateTime\(form.requestedFor\)/);
 assert.match(form,/same location/);
 assert.match(native,/saved.vehicles.slice\(0, MAX_VEHICLES\)/);
 assert.doesNotMatch(native,/Inspection requires one|vehicles.length !== 1/);
 assert.match(read('backend/src/services/dto/index.ts'),/@ArrayMaxSize\(12\)/);
});
test('draft handoff, retail listing context and auction refusal stay separate',()=>{
 assert.match(form,/prepareSignIn\(\)/);assert.match(form,/useSessionDraft\(/);
 assert.match(form,/listingId: v.listingId \|\| undefined/);
 assert.match(form,/clearDraft\(\)/);
 assert.match(read('src/components/services/VehicleServicesPanel.tsx'),/Request Inspection/);
 assert.match(read('carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx'),/serviceType:'INSPECTION',purchase:\{listingId:listing.id/);
 assert.match(read('src/components/services/ArrangeInspection.tsx'),/createInspectionFromAuction\(\{ auctionId \}\)/);
 assert.match(landing,/general inspection request does not qualify/);
});
test('quotes show whole-job price and actual provider summary rather than assumed availability or a recommended cheapest provider',()=>{
 const quotes=read('src/app/services/jobs/[id]/page.tsx');
 assert.match(quotes,/Total for the whole request/);assert.match(quotes,/Proposed scope and availability/);
 assert.match(quotes,/c\?\.serviceArea/);assert.match(quotes,/quote.message \|\| "No additional details supplied/);
 assert.match(quotes,/Lowest current quote/);
 const n=read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
 assert.match(n,/Total for the whole request/);assert.match(n,/New to CarMazium/);
});
