import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/listing/SellerServiceBadges.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(require, exports);
const render = seller => renderToStaticMarkup(React.createElement(exports.SellerServiceBadges, { seller }));
test('no dealership or opted-out seller has no service badges', () => {
    assert.equal(render(undefined), '');
    assert.equal(render(null), '');
    assert.equal(render({ financeOffered: false, warrantyOffered: false }), '');
});
test('badges are isolated to each listing owner and can be switched independently', () => {
    const finance = render({ financeOffered: true, warrantyOffered: false });
    const warranty = render({ financeOffered: false, warrantyOffered: true });
    assert.match(finance, /Seller can arrange finance/);
    assert.doesNotMatch(finance, /Seller offers warranties/);
    assert.match(warranty, /Seller offers warranties/);
    assert.doesNotMatch(warranty, /Seller can arrange finance/);
    assert.match(finance, /Contact this seller/);
    assert.match(warranty, /Contact this seller/);
});
test('both enabled badges remain contact-seller statements, without a platform offer or invented terms', () => {
    const html = render({ financeOffered: true, warrantyOffered: true });
    assert.match(html, /Seller can arrange finance/);
    assert.match(html, /Seller offers warranties/);
    assert.match(html, /availability, eligibility, prices and terms/);
    assert.doesNotMatch(html, /guaranteed|approved|APR|months|£/i);
});

test('retail detail renders owner badges in both responsive seller panels', () => {
    const detail = readFileSync(new URL('../src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('detail.tsx', detail, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const panels = [];
    const visit = node => {
        if (ts.isJsxElement(node)) {
            const className = node.openingElement.attributes.properties.find(attr =>
                ts.isJsxAttribute(attr) && attr.name.text === 'className' && attr.initializer && ts.isStringLiteral(attr.initializer));
            const classes = className?.initializer.text.split(/\s+/) ?? [];
            if ((classes.includes('block') && classes.includes('lg:hidden')) ||
                (classes.includes('hidden') && classes.includes('lg:block') && classes.includes('lg:col-span-1'))) {
                panels.push(node.getText(ast));
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(panels.length, 2, 'mobile and desktop seller panels are both covered');
    for (const panel of panels) {
        assert.match(panel, /<SellerServiceBadges seller=\{listing\.seller\?\.dealerProfile\} \/>/);
    }
});
