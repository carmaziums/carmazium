import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path) {
    const exports = {};
    new Function('exports', ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports);
    return exports;
}
const web = load('../src/lib/vehicleSharing.ts');
const native = load('../carmazium app/carmazium app/src/lib/vehicleSharing.ts');
test('retail shares a canonical listing URL, including caravans with no car specifications', () => {
    assert.equal(web.vehicleShareUrl({ id: '123', slug: 'manual-caravan', title: 'Caravan', type: 'CLASSIFIED' }), 'https://www.carmazium.com/buy-cars/manual-caravan');
    assert.equal(web.vehicleShareUrl({ id: '123' }), 'https://www.carmazium.com/buy-cars/123');
});
test('auctions share the actual auction ID, not the listing ID', () => {
    const listing = { id: 'listing-123', type: 'AUCTION', auction: { id: 'auction-456' } };
    assert.equal(web.vehicleShareUrl(listing), 'https://www.carmazium.com/auctions/live/auction-456');
    assert.equal(web.vehicleShareUrl({ id: 'listing-123' }, 'auction-456'), 'https://www.carmazium.com/auctions/live/auction-456');
    assert.equal(web.vehicleShareUrl({ id: 'listing-123', type: 'AUCTION' }), 'https://www.carmazium.com/vehicle/listing-123');
});
test('untrusted slugs cannot add a session query, fragment or external origin', () => {
    const url = new URL(web.vehicleShareUrl({ id: '1', slug: '//evil.invalid/a?token=secret#private' }));
    assert.equal(url.origin, 'https://www.carmazium.com'); assert.equal(url.search, ''); assert.equal(url.hash, '');
    assert.throws(() => web.vehicleShareUrl({ id: '' }), /shareable link/);
});
test('WhatsApp, Facebook and email preserve Unicode and safely encode the exact vehicle URL', () => {
    const title = 'Caravan & campervan £4,995'; const url = web.vehicleShareUrl({ id: '1', slug: 'tourer' });
    const links = web.vehicleShareLinks(title, url);
    assert.equal(new URL(links.whatsapp).searchParams.get('text'), `${title} on CarMazium\n${url}`);
    assert.equal(new URL(links.facebook).searchParams.get('u'), url);
    assert.equal(new URL(links.email).searchParams.get('body'), `${title} on CarMazium\n${url}`);
    assert.equal(new URL(links.email).searchParams.get('subject'), `${title} on CarMazium`);
});
test('sharing explains private, dealer-only and unavailable access without claiming publication', () => {
    assert.match(web.vehicleShareNotice({ id: '1', status: 'DRAFT' }), /not public/);
    assert.match(web.vehicleShareNotice({ id: '1', type: 'AUCTION' }), /verified dealer/);
    assert.match(web.vehicleShareNotice({ id: '1', status: 'SOLD' }), /no longer be available/);
});
test('web and native resolve identical retail and auction links', () => {
    for (const vehicle of [{ id: '1' }, { id: '1', slug: 'tourer' }, { id: '1', type: 'AUCTION' }, { id: '1', type: 'AUCTION', auction: { id: '2' } }]) assert.equal(native.vehicleShareUrl(vehicle), web.vehicleShareUrl(vehicle));
});
test('both Android and iOS share a working link rather than text alone', () => {
    for (const platform of ['android', 'ios']) {
        const result = native.nativeVehicleSharePayload({ id: '1', title: 'Touring caravan' }, platform);
        const combined = `${result.message} ${result.url || ''}`;
        assert.match(combined, /https:\/\/www.carmazium.com\/buy-cars\/1/);
        assert.doesNotMatch(combined, /undefined|null/);
        assert.equal((combined.match(/https:/g) || []).length, 1);
        const auction = native.nativeVehicleSharePayload({ id: '1', title: 'Vehicle', type: 'AUCTION' }, platform, '2');
        assert.match(`${auction.message} ${auction.url || ''}`, /auctions\/live\/2/);
    }
});
