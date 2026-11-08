import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root = new URL('../src/lib/', import.meta.url);
function load(name) {
 const source = readFileSync(new URL(name + '.ts', root), 'utf8');
 const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context = {exports:{}, require: path => load(path.replace('./',''))};
 vm.runInNewContext(compiled, context);
 return context.exports;
}
const {motLookupMessage, importedOfficialFacts} = load('vehicleLookupFeedback');
const history = [{completedDate:'2026-01-01',testResult:'PASSED',motTestNumber:'123',odometerValue:'12345'}];
test('outages and mismatched records are never described as no MOT tests', () => {
 assert.match(motLookupMessage({motHistoryStatus:'UNAVAILABLE'}), /temporarily unavailable/);
 assert.match(motLookupMessage({motHistoryStatus:'UNAVAILABLE'}), /does not mean/);
 assert.match(motLookupMessage({motHistoryStatus:'IDENTITY_MISMATCH'}), /did not match/);
 assert.match(motLookupMessage({motHistoryStatus:'NO_TESTS'}), /DVSA returned no MOT tests/);
});
test('fresh and saved history are distinguished', () => {
 assert.equal(motLookupMessage({motHistoryStatus:'AVAILABLE',motHistory:history}), 'MOT history loaded: 1 tests.');
 assert.match(motLookupMessage({motHistory:history}), /Saved MOT history/);
 assert.match(motLookupMessage({}), /has not been confirmed/);
});
test('import preserves complete MOT and official facts but never historical odometer as current mileage', () => {
 const source = {motHistoryStatus:'AVAILABLE',motHistory:history,lastMotMileage:{value:12345,unit:'MI'},dateOfLastV5CIssued:'2026-01-01',markedForExport:false,firstUsedDate:'2017-03-01',officialVehicleData:{mot:{lastMotTestDate:'2026-01-01'}}};
 const fields = importedOfficialFacts(source);
 assert.deepEqual(JSON.parse(JSON.stringify(fields.motHistory)),history);
 assert.equal(fields.officialVehicleData,source.officialVehicleData);
 assert.equal(fields.dateOfLastV5CIssued,'2026-01-01');
 assert.equal(fields.markedForExport,false);
 assert.equal('mileage' in fields,false);
 assert.equal('lastMotMileage' in fields,false);
});
test('failed and empty lookups omit history instead of overwriting a saved snapshot', () => {
 for (const motHistoryStatus of ['UNAVAILABLE','IDENTITY_MISMATCH','NO_TESTS']) {
  assert.equal(importedOfficialFacts({motHistoryStatus,motHistory:history}).motHistory,undefined);
 }
 assert.equal(importedOfficialFacts({motHistory:[]}).motHistory,undefined);
});
