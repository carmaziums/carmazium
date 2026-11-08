const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPatch, guardedWhere } = require('./restore-official-dvla-fields.cjs');
const listing = { id:'test', status:'ACTIVE', vrm:'AB17XYZ', make:'Land Rover', year:2017, updatedAt:new Date(), deletedAt:null };
const official = { dataSource:'DVLA', vrm:'AB17XYZ', make:'LAND ROVER', year:2017, colour:'BLUE', engineSize:1999, fuelType:'DIESEL', motStatus:'Valid', motExpiryDate:'2027-06-01', co2Emissions:0, markedForExport:false };
test('fills available gaps including legitimate zero and false values', () => {
  assert.deepEqual(buildPatch(listing, official).patch, {color:'BLUE',motStatus:'Valid',motExpiryDate:'2027-06-01',engineSize:1999,co2Emissions:0,fuelType:'DIESEL',markedForExport:false});
});
test('preserves existing values, mileage, prices and history', () => {
  const current = {...listing,color:'GREY',motStatus:'Not valid',motExpiryDate:'2026-06-01',engineSize:2000,co2Emissions:125,fuelType:'PETROL',markedForExport:true,mileage:90000,price:5000,motHistory:[{saved:true}]};
  assert.deepEqual(buildPatch(current,{...official,mileage:120000,price:1,motHistory:[{replacement:true}]}).patch,{});
});
test('rejects other registrations, makes, years, or unauthoritative data', () => {
  for(const change of [{vrm:'XX17ZZZ'},{make:'FORD'},{year:2008},{dataSource:'AI'}]) assert.equal(buildPatch(listing,{...official,...change}).reason,'identity_mismatch');
});
test('does not modify sold, withdrawn, deleted or accepted-offer records', () => {
  for(const status of ['SOLD','WITHDRAWN','REJECTED','OFFER_ACCEPTED']) assert.equal(buildPatch({...listing,status},official).reason,'lifecycle');
  assert.equal(buildPatch({...listing,deletedAt:new Date()},official).reason,'lifecycle');
});
test('normalizes make accents without replacing sellers text', () => {
  const patch=buildPatch({...listing,make:'Citroën'},{...official,make:'CITROEN'}).patch;
  assert.ok(patch);assert.equal(patch.make,undefined);
});
test('merges only missing supplementary government fields', () => {
  const patch=buildPatch({...listing,officialVehicleData:{dvla:{rawFuelType:'Existing',revenueWeight:0}}},{...official,officialVehicleData:{dvla:{rawFuelType:'DIESEL',revenueWeight:2400,automatedVehicle:false}}}).patch;
  assert.deepEqual(patch.officialVehicleData,{dvla:{rawFuelType:'Existing',revenueWeight:0,automatedVehicle:false}});
});
test('writes require unchanged identity, lifecycle and version', () => {
  assert.deepEqual(guardedWhere(listing),{id:listing.id,updatedAt:listing.updatedAt,deletedAt:null,status:'ACTIVE',vrm:'AB17XYZ',make:'Land Rover',year:2017});
});
test('allows drafts and pending review without changing their statuses', () => {
  for(const status of ['DRAFT','PENDING_REVIEW']) {const patch=buildPatch({...listing,status},official).patch;assert.ok(patch);assert.equal(patch.status,undefined);}
});
