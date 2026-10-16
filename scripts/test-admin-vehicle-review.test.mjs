import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('src/app/dashboard/admin/listings/page.tsx');
const panel = read('src/components/admin/AdminVehicleReviewPanel.tsx');
const rules = read('src/lib/adminVehicleReview.ts');
const service = read('backend/src/admin/admin.service.ts');
const ctrl = read('backend/src/admin/admin.controller.ts');
const linked = read('backend/src/listings/listings.service.ts');

test('admin-only warnings name exactly which fields and explain where they originate', () => {
    assert.match(page, /AdminVehicleReviewPanel/);
    assert.equal((page.match(/<AdminVehicleReviewPanel/g) || []).length, 2);
    assert.doesNotMatch(page, /retailCompletenessGaps/);
    for (const value of ['getAdminVehicleReviewItems', 'item.label', 'item.source', 'item.explanation', 'item.currentValue']) {
        assert.ok(panel.includes(value), value);
    }
    for (const field of ['model', 'transmission', 'motExpiryDate', 'motHistory', 'numberOfKeys', 'serviceHistory']) {
        assert.ok(rules.includes(field), field);
    }
    assert.match(rules, /BHP, MPG, equipment and postcode coordinates are optional/);
    assert.doesNotMatch(read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx'), /AdminVehicleReviewPanel/);
    assert.doesNotMatch(read('src/app/vehicle/[id]/VehicleDetailPageClient.tsx'), /AdminVehicleReviewPanel/);
});

test('admin actions are role-guarded, explicit and non-destructive', () => {
    assert.match(ctrl, /@Roles\(UserRole\.ADMIN\)/);
    assert.match(ctrl, /@Post\('listings\/:id\/refresh-official-data'\)/);
    assert.match(ctrl, /@Post\('listings\/:id\/request-seller-details'\)/);
    assert.match(service, /lookupVrm\(listing\.vrm, false\)/);
    assert.match(service, /status === 'SOLD'/);
    assert.match(service, /updatedAt: current\.updatedAt/);
    assert.match(service, /sellerId === listing\.sellerId/);
    assert.match(service, /type !== listing\.type/);
    assert.match(panel, /Recheck DVLA \/ MOT/);
    assert.match(panel, /Ask seller/);
    assert.match(panel, /Correct as admin/);
});

test('both linked channels retain the official MOT history and first-use dates', () => {
    assert.equal((linked.match(/motHistory: source\.motHistory \?\? undefined/g) || []).length, 2);
    assert.equal((linked.match(/firstUsedDate: source\.firstUsedDate/g) || []).length, 2);
    assert.equal((linked.match(/dateOfLastV5CIssued: source\.dateOfLastV5CIssued/g) || []).length, 2);
    assert.match(linked, /source\.linkedListingId/);
});
