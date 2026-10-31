import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin payout screen offers secure bank-details request after a Stripe transfer fails", () => {
    const ui = read("src/app/dashboard/admin/handovers/page.tsx");
    assert.match(ui, /requestSellerBankDetailsForBonus/);
    assert.match(ui, /Request Bank Details/);
    assert.match(ui, /CarMazium.*Stripe balance is insufficient/);
    assert.match(ui, /ALREADY transferred £100/);
    assert.match(ui, /p\.listing\?\.seller\?\.bankAccountNumber/);
});

test("manual fallback is accessible to admin but does not pay or reveal bank data in notifications", () => {
    const admin = read("backend/src/admin/admin.service.ts");
    const controller = read("backend/src/admin/admin.controller.ts");
    assert.match(controller, /@Post\('payouts\/:auctionId\/request-bank-details'\)/);
    assert.match(admin, /async requestSellerBankDetailsForBonus\(auctionId: string\)/);
    assert.match(admin, /assertHandoverBusinessRules\(auctionId, \{/);
    assert.match(admin, /manual_bonus_bank_details_needed/);
    assert.match(admin, /alreadyOnFile: true/);
    assert.match(admin, /alreadyRequested: true/);
    assert.match(admin, /this\.requestSellerBankDetailsForBonus\(auctionId\)/);
    const notification = admin.match(/title: 'Bank details needed for your £100 seller reward'[\s\S]*?data: \{ action: 'manual_bonus_bank_details_needed' \}/)?.[0];
    assert.ok(notification);
    assert.doesNotMatch(notification, /bankAccountNumber|bankSortCode|bankAccountName/);
    assert.match(admin, /sellerBonusTransferFailureMessage\(err\)/);
});

test("seller is directed to authenticated payouts form, never to reply with bank details", () => {
    const email = read("backend/src/email/email.service.ts");
    assert.match(email, /sendManualSellerBankDetailsRequestEmail/);
    assert.match(email, /profile\?section=payouts/);
    assert.match(email, /do not reply with bank details/);
    assert.match(read("src/app/profile/page.tsx"), /Save bank details/);
});

test("payment state only changes when Stripe transfer or actual manual payment is recorded", () => {
    const admin = read("backend/src/admin/admin.service.ts");
    const part = admin.split('async requestSellerBankDetailsForBonus(auctionId: string)')[1]
        ?.split('async sendStripePayoutSetupReminder(')[0];
    assert.ok(part);
    assert.doesNotMatch(part, /manualPayoutConfirmedAt: paidAt|stripePayoutTransferId: transferId/);
    assert.match(admin, /async markPayoutPaidManually\(auctionId: string\)/);
});
