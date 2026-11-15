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
const { serviceVerificationPath } = load('serviceSetupRouting');
const { partnershipSubject } = load('partnershipContact');
for (const type of ['DELIVERY', 'INSPECTION']) test(`${type} opens its own newly created or existing capability for dealer and contractor responses`, () => {
    const cap = { id: `cap-${type}`, serviceType: type };
    for (const response of [cap, { data: cap }]) assert.equal(serviceVerificationPath(response, type), `/dashboard/service/capabilities/cap-${type}/verification`);
});
test('wrong service, invalid response and unsafe path never route the user to another application', () => {
    for (const response of [null, {}, { id: 'x', serviceType: 'WARRANTY' }, { id: '../x', serviceType: 'DELIVERY' }, { id: 'x/y', serviceType: 'DELIVERY' }, { id: 'x', serviceType: 'INSPECTION' }]) {
        assert.throws(() => serviceVerificationPath(response, 'DELIVERY'), /could not be opened/);
    }
});
test('partnership topics prepare only the matching public enquiry subject', () => {
    for (const type of ['finance', 'insurance', 'warranty']) assert.match(partnershipSubject(`${type}-partnership`).toLowerCase(), new RegExp(`^${type} provider integration and partnership$`));
    for (const topic of [null, '', 'constructor', '__proto__', 'personal data']) assert.equal(partnershipSubject(topic), '');
});
