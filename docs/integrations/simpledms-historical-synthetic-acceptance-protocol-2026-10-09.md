# SimpleDMS historical synthetic acceptance protocol — 9 October 2026

**Environment:** isolated synthetic SimpleDMS staging only.  
**Production:** disabled.  
**Credential:** existing SimpleDMS staging credential.  
**Synthetic vehicle registration:** `STAGING-NOT-A-REAL-VRM`.

This protocol is for development and acceptance of SimpleDMS automatic refresh and historical vehicle-event functionality. It uses only fictional data.

## Rules

- Complete the phases in order.
- SimpleDMS should run its normal full refresh/reconciliation path, not a special one-off importer.
- Do not treat a failed/incomplete refresh as a successful empty snapshot.
- Do not expose or retain bidder identity, seller identity, reserve, VIN, private documents, payment data or CarMazium internal valuation.
- Historical photographs must not be retained.
- Raw synthetic VRM may be used transiently for matching but should not remain in the retained historical event record after protected-identifier conversion.
- Observed bids are observations only, not sale prices.
- CarMazium changes one synthetic phase only after SimpleDMS confirms the prior phase has been captured.

## Phase A — baseline active observation

Scenario: `history-a`

Expected live values:
- auction ID: `11111111-1111-4111-8111-111111111111`
- listing ID: `22222222-2222-4222-8222-222222222222`
- fictional registration: `STAGING-NOT-A-REAL-VRM`
- mileage: **40,000**
- starting bid: **£5,000**
- current observed bid: **£5,200**
- close time: approximately one hour after feed generation

SimpleDMS acceptance:
- full refresh succeeds;
- one live fictional vehicle appears;
- historical baseline event is captured;
- protected matching identifier is created;
- retained historical record does not keep raw VRM after conversion;
- no prohibited fields are retained.

**Checkpoint A:** SimpleDMS confirms capture before CarMazium advances.

## Phase B — observed bid change

Scenario: `history-bid`

Same auction/listing/vehicle identity as Phase A.

Change:
- current observed bid: **£5,450**
- mileage remains **40,000**
- starting bid remains **£5,000**

SimpleDMS acceptance:
- live row updates rather than duplicates;
- one new changed-bid observation may be recorded;
- unchanged £5,200 is not repeatedly duplicated on later refreshes;
- no bidder identity is stored;
- £5,450 is labelled/treated as an observed bid, not final bid or sale price.

**Checkpoint B:** SimpleDMS confirms capture and deduplication.

## Phase C — extended auction closing time

Scenario: `history-extended`

Same auction/listing/vehicle identity as Phases A/B.

Change:
- current observed bid remains **£5,450**
- close time moves to approximately four hours after feed generation

SimpleDMS acceptance:
- existing live auction is updated;
- extension does not create a new historical vehicle/event identity;
- unchanged bid is not duplicated merely because closing time changed;
- revised end time is reflected in live inventory.

**Checkpoint C:** SimpleDMS confirms extension handling.

## Phase D — auction ends / disappears

Scenario: `ended`

Expected:
- complete live feed total: **0**
- auction detail: **HTTP 404**

SimpleDMS acceptance:
- live vehicle disappears after complete reconciliation;
- permitted historical evidence from A–C remains within the licensed historical store;
- raw live cache/photo copies are handled under the operational-cache rules;
- historical photos remain absent.

**Checkpoint D:** SimpleDMS confirms live removal and historical preservation.

## Phase E — same fictional vehicle returns later

Scenario: `history-return`

Expected:
- new auction ID: `11111111-1111-4111-8111-000000000002`
- new listing ID: `22222222-2222-4222-8222-000000000002`
- same fictional registration: `STAGING-NOT-A-REAL-VRM`
- mileage: **40,125**
- starting bid: **£5,000**
- current observed bid: **£5,600**
- close time: approximately two hours after feed generation

SimpleDMS acceptance:
- live inventory shows a new auction/listing, not a resurrection of the old auction ID;
- protected matching links the new appearance to the earlier fictional vehicle history;
- dealer research can compare 40,000 → 40,125 miles and the earlier permitted observed-bid evidence;
- raw VRM is not retained in historical event records;
- no historical photograph is retained.

**Checkpoint E:** SimpleDMS confirms repeat-appearance matching and provides redacted acceptance evidence.

## Separate fail-safe acceptance

SimpleDMS must additionally evidence:
- normal complete reconciliation target approximately every **2 minutes**, within the agreed 2–5 minute window;
- failed/incomplete refresh retains the last good snapshot;
- after more than **15 minutes** without a successful refresh, CarMazium stock is hidden or clearly unavailable;
- recovery after a successful refresh restores current live state without duplicate historical events.

## Retention/deletion evidence

Before production approval SimpleDMS should provide redacted evidence that:
- event expiry is **36 months from the vehicle's last permitted CarMazium observation**;
- ordinary access/use does not reset that event clock;
- expired evidence is not reconstructed from reports, caches or backups for new research;
- CarMazium correction/deletion notices can be propagated to active historical records/reports where required;
- provider backup residuals are unavailable for ordinary use and expire under their normal recovery cycle.

## Completion

Historical synthetic acceptance is complete only when all checkpoints A–E plus fail-safe and retention/deletion evidence have passed.

Passing this protocol does **not** enable production. A separate production credential and controlled production acceptance window still require the signed agreement, closed DPIA/LIA controls, final CarMazium release approval and written go-live approval from both parties.
