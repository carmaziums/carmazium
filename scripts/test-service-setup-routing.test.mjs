import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(name) {
    const exports = {};
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
    return exports;
}
const { validatedServiceCapability } = load('serviceSetupRouting');
const { partnershipSubject } = load('partnershipContact');
for (const type of ['DELIVERY', 'INSPECTION']) test(`${type} validates the selected service capability without navigating to obsolete verification pages`, () => {
    const cap = { id: `cap-${type}`, serviceType: type };
    for (const response of [cap, { data: cap }]) assert.deepEqual(validatedServiceCapability(response, type), cap);
});
test('wrong service, invalid response and unsafe IDs are rejected before opening inline setup', () => {
    for (const response of [null, {}, { id: 'x', serviceType: 'WARRANTY' }, { id: '../x', serviceType: 'DELIVERY' }, { id: 'x/y', serviceType: 'DELIVERY' }, { id: 'x', serviceType: 'INSPECTION' }]) {
        assert.throws(() => validatedServiceCapability(response, 'DELIVERY'), /could not be verified/);
    }
});
test('partnership topics prepare only the matching public enquiry subject', () => {
    for (const type of ['finance', 'insurance', 'warranty']) assert.match(partnershipSubject(`${type}-partnership`).toLowerCase(), new RegExp(`^${type} provider integration and partnership$`));
    for (const topic of [null, '', 'constructor', '__proto__', 'personal data']) assert.equal(partnershipSubject(topic), '');
});
