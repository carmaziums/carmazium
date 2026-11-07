import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const native = 'carmazium app/carmazium app/src/';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function load(path, deps = {}) { const exports = {}; vm.runInNewContext(compile(read(path)), { exports, URLSearchParams, require: name => { if (name in deps) return deps[name]; throw Error(name); } }); return exports; }
// Execute the actual native state/parameter functions, with state setters in place of React rendering.
function nativeState() {
  const source = read(native+'screens/main/SearchScreen.tsx');
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const snippets = [], setters = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) {
      const name = n.name.getText(ast), init = n.initializer;
      if (['QUICK_FILTERS','FUEL_MAP','CURRENT_YEAR'].includes(name)) snippets.push(`const ${name} = ${init.getText(ast)};`);
      if (ts.isArrayBindingPattern(n.name) && init && ts.isCallExpression(init) && init.expression.getText(ast) === 'useState') {
        const [state,setter] = n.name.elements.map(e=>e.name.getText(ast));
        snippets.push(`let ${state} = ${init.arguments[0]?.getText(ast) ?? 'undefined'};`);
        snippets.push(`const ${setter} = value => { ${state} = typeof value === 'function' ? value(${state}) : value; };`);
        setters.push(setter);
      }
      if (name === 'resetFilters' || name === 'applyQuickFilter') snippets.push(`const ${name} = ${init.getText(ast)};`);
    }
    if (ts.isFunctionDeclaration(n) && ['applySearchParams','buildParams'].includes(n.name?.text)) snippets.push(n.getText(ast));
    ts.forEachChild(n, visit);
  } visit(ast);
  const sandbox = { route:{params:{}}, userLat:null,userLng:null };
  vm.runInNewContext(compile(snippets.join('\n')+`\nglobalThis.api = {applySearchParams, buildParams, resetFilters, applyQuickFilter, ${setters.join(',')}};`),sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
test('AI mileage, price, booleans and technical filters survive native navigation and request construction', () => {
  const h=nativeState();
  h.applySearchParams({fuelType:'PETROL',transmission:'AUTOMATIC',maxPrice:'250000',maxMileage:'62500',minYear:'2015',maxEngine:'1600',ulezCompliant:'true',isImported:'false',location:'Birmingham'});
  assert.deepEqual(plain(h.buildParams()), {fuelTypes:['PETROL'],transmissions:['AUTOMATIC'],maxPrice:250000,maxMileage:62500,minYear:2015,maxEngine:1600,ulezCompliant:true,isImported:false,location:'Birmingham',vehicleType:'CAR',sortBy:'newest',page:1,limit:20});
  h.applySearchParams({make:'Kia',model:'Ceed'});
  assert.deepEqual(plain(h.buildParams()), {make:'Kia',model:'Ceed',vehicleType:'CAR',sortBy:'newest',page:1,limit:20});
});
test('native manual quick filter works and Reset removes keyword, quick and advanced criteria',()=>{
  const h=nativeState(); h.applySearchParams({maxCo2:'100',model:'Ceed',maxYear:'2018'}); h.setQuery('red');
  h.applyQuickFilter('manual');
  assert.deepEqual(plain(h.buildParams()),{transmissions:['MANUAL'],vehicleType:'CAR',sortBy:'newest',page:1,limit:20});
  h.resetFilters(); assert.deepEqual(plain(h.buildParams()),{vehicleType:'CAR',sortBy:'newest',page:1,limit:20});
  h.setMaxMiles('60k'); assert.equal(h.buildParams().maxMileage,60000);
  h.setMaxMiles('62500'); assert.equal(h.buildParams().maxMileage,62500);
  h.setMaxPrice(0); assert.equal(h.buildParams().maxPrice,0);
});
test('web and native option overlays include new live makes, models and trims without losing curated choices',()=>{
  assert.equal(read('src/lib/vehicleSearchOptions.ts'),read(native+'data/vehicleSearchOptions.ts'));
  const catalogue=load('src/lib/carData.ts'), options=load('src/lib/vehicleSearchOptions.ts',{'./carData':catalogue});
  const stock=[{make:'New Manufacturer',model:'New Model',variant:'Special',vehicleType:'CAR'}, {make:'CITROEN',model:'C4 Grand Picasso',variant:'Exclusive',vehicleType:'CAR'}, {make:'Motorcycle Make',model:'Bike',vehicleType:'MOTORCYCLE'}];
  const makes=options.searchMakes(stock,'CAR');
  assert.ok(makes.includes('New Manufacturer'));assert.ok(makes.includes('Citroën'));assert.ok(!makes.includes('CITROEN'));assert.ok(!makes.includes('Motorcycle Make'));
  assert.ok(options.searchModels(stock,'Citroën','CAR').includes('C4 Grand Picasso'));
  assert.ok(options.searchModels(stock,'CITROEN','CAR').includes('C3'));
  assert.deepEqual(plain(options.searchVariants(stock,'New Manufacturer','New Model','CAR')),['Special']);
  assert.equal(options.searchMakes([]).length,catalogue.CAR_MAKES.length);
});
test('both API clients serialize every shared filter with the same values',async()=>{
  const urls=[];const apiClient=async url=>{urls.push(url);return {data:[],pagination:{total:0}};};
  const web=load('src/lib/listingApi.ts',{'./apiClient':{apiClient},'./listingMotHistory':{}});
  const mobile=load(native+'lib/listingsApi.ts',{'./apiClient':{apiClient},'./transmission':{}});
  const filters={make:'Citroën',model:'C4 Grand Picasso',minPrice:0,maxPrice:250000,minYear:1999,maxYear:2026,minMileage:12345,maxMileage:62500,fuelTypes:['PETROL','ELECTRIC'],transmissions:['AUTOMATIC','CVT'],bodyType:'SUV',minEngine:0,maxEngine:1600,maxCo2:100,minBhp:80,maxBhp:200,minCombinedMpg:45.5,maxZeroTo60Mph:9.8,driveType:'FWD',ulezCompliant:false,isImported:false,deliveryAvailable:true,motValid:true,taxedOnly:true,serviceHistories:['PARTIAL'],maxOwners:3,vehicleType:'CAR',location:'Birmingham',features:['Heated Seats'],conditions:['GOOD'],exteriorGrades:[1,2],writeOffCategories:['NONE'],euroStandard:'EURO_6',minDoors:5,minSeats:7,color:'Blue',sellerType:'PRIVATE',variant:'SE',sortBy:'price_asc',page:2,limit:20,maxDistanceMi:25,originLatitude:52.5,originLongitude:-1.9};
  await web.getListings(filters);await mobile.searchListings({...filters,strictErrors:true});
  const entries=url=>Object.fromEntries([...new URL('https://example.test'+url).searchParams].sort());
  assert.deepEqual(entries(urls[0]),entries(urls[1]));
});

test('AI equipment vocabulary stays identical to web/native seller options',()=>{
  assert.equal(read('src/lib/vehicleFeatures.ts'),read('backend/src/ai/search-feature-options.ts'));
});

function webState(params) {
 const source=read('src/app/search/page.tsx'), ast=ts.createSourceFile('search.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), snippets=[];
 const constants=['PAGE_SIZE','FUEL_MAP','REVERSE_FUEL_MAP','TRANS_MAP','REVERSE_TRANS_MAP','CONDITION_OPTIONS','WRITE_OFF_OPTIONS','SERVICE_HISTORY_OPTIONS'];
 function visit(n){
  if(ts.isVariableDeclaration(n)){
   const name=n.name.getText(ast),init=n.initializer;
   if(constants.includes(name))snippets.push(`const ${name}=${init.getText(ast)};`);
   if(['hydrateFromUrl','buildApiFilters'].includes(name))snippets.push(`const ${name}=${init.arguments[0].getText(ast)};`);
  }ts.forEachChild(n,visit);
 }visit(ast);
 const context={searchParams:new URLSearchParams(params)};vm.runInNewContext(compile(snippets.join('\n')+'\nglobalThis.result={state:hydrateFromUrl(),params:buildApiFilters(hydrateFromUrl())};'),context);return context.result;
}
test('AI filters become equivalent web/native requests, including false and multi-select values',()=>{
 const params={maxMileage:'62500',maxEngine:'1600',maxPrice:'250000',fuelTypes:'PETROL,ELECTRIC',transmissions:'AUTOMATIC,CVT',isImported:'false',ulezCompliant:'true',location:'Birmingham',minSeats:'7',maxCo2:'100',features:'Heated Seats',vehicleType:'CAR'};
 const web=webState(params);const mobile=nativeState();mobile.applySearchParams(params);
 const {page,limit,...nativeParams}=plain(mobile.buildParams());
 const {limit: webLimit,...webParams}=plain(web.params);
 assert.deepEqual(webParams,nativeParams);
 assert.deepEqual(plain(web.state.fuelTypes),['Petrol','Electric']);
 assert.deepEqual(plain(web.state.transmissions),['Automatic','CVT']);
});
test('website carries multiple make choices into the API and survives URL reload',()=>{
 const web=webState({makes:'Toyota,Honda',vehicleType:'CAR'});
 assert.deepEqual(plain(web.params.makes),['Toyota','Honda']);assert.equal(web.params.make,undefined);
});
