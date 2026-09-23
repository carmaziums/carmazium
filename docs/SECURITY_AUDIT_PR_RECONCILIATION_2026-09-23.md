# Security audit — reconciliation against merged PRs

**Date:** 23 September 2026
**Baseline:** the findings raised in this engagement (see "Findings baseline" below)
**PR window:** 111 PRs merged into `carmaziums/carmazium` between 16 and 23 September 2026

---

## 1. Reconciliation & coverage check

### Headline

**None of the confirmed security findings were closed by the 111 merged PRs.** Every one was
still live when checked directly against production this week, and each has been fixed during
this engagement instead.

The hardening effort was real and substantial — roughly 20 PRs carry "Harden" or
"Secure" in the title — but it was aimed almost entirely at **TradeXchange**, a subsystem
that PR #110's own description records as having *"0 TradeXchange attachment rows and 0
legacy TradeXchange objects"* in production.

Meanwhile the systems holding live customer data were untouched. Across all 111 PRs:

| File | Why it matters | PRs touching it |
|---|---|---|
| `backend/src/users/users.service.ts` | privilege escalation, mass-assignment | **0** |
| `backend/src/users/users.controller.ts` | unauthenticated role assignment | **0** |
| `src/components/dashboard/KycOverlayForm.tsx` | uploaded 43 identity documents to a public bucket | **0** |

That is the single most important number in this report. Effort went to the subsystem with
no users; the subsystem with real passports and driving licences in it received none.

### Finding-by-finding

| # | Finding | Severity | Closed by a merged PR? | Status now |
|---|---|---|---|---|
| 1 | Dealer KYC documents in a public bucket (43 objects: passports, licences, proof of address) | Critical | ❌ No | ✅ Fixed + all 43 remediated, verified 0 remaining |
| 2 | Auction handover proof in a public bucket (9 objects, incl. a signed PDF with both parties' names and addresses) | High | ❌ No — knowingly deferred by PR #97 | ✅ Fixed + all 9 remediated, verified 0 remaining |
| 3 | `/users/elevate` privilege escalation — any user could grant themselves a role | Critical | ❌ No | ✅ Fixed |
| 4 | `/users/sync` accepted an unauthenticated body and assigned roles from it | Critical | ❌ No | ✅ Fixed — identity now taken from the verified token |
| 5 | Dealer profile mass-assignment — `isVerified` settable by the client | High | ❌ No | ✅ Fixed — explicit whitelist |
| 6 | Unverified dealers displayed to admin as verified; KYC bypass | High | ❌ No | ✅ Fixed |
| 7 | Trade stock readable by non-dealers (exposes forecourt cost base) | Medium | ❌ No | ✅ Fixed — `VerifiedDealerGuard` |
| 8 | Two live 500s hidden by SWC not typechecking (dashboard, auction close) | High | ❌ No | ✅ Fixed |
| 9 | 34 TypeScript errors compiling clean; no CI typecheck gate | High | ❌ No | ✅ Fixed + CI gate added |
| 10 | Live Postgres password in git history across three public repos | Critical | ❌ No | ⚠️ **Still open** |

**Score: 0 of 10 closed by merged PRs. 9 of 10 closed during this engagement. 1 still open.**

---

## 2. Gap analysis

### 2.1 The subsystem mismatch

The PR titles read like a security programme: *Harden TradeXchange provider authorization*,
*Harden TradeXchange dealership staff permissions*, *Harden TradeXchange Finance and Warranty
matching privacy*, *Secure TradeXchange private document storage*. Eighteen of them.

All target a feature with zero production rows. None target the live marketplace.

This is not an argument against that work — TradeXchange should be secure before launch. It is
an argument about **sequencing**: the live system was carrying real identity documents in
public storage the entire time that effort ran.

### 2.2 The name collision

**This is the most dangerous item in this report.**

PR #110 is titled *"Secure TradeXchange private document storage"*. Its body describes exactly
the vulnerability class that applied to dealer KYC:

> *provider verification documents were uploaded by the browser to the public `listings` bucket*
> *permanent public URLs were stored...*

Anyone reconciling a findings list against PR titles would reasonably tick off
"documents in public storage — fixed". It was not fixed. PR #110 covers **TradeXchange**
provider/dispute documents. **Dealer KYC is a different subsystem, in different files, and it
still had 43 live documents in the public bucket nine days later.**

Two subsystems, near-identical vulnerabilities, near-identical remediation language, one fixed
and one not. Any future reconciliation must be done against **files and live data**, never
against PR titles.

### 2.3 Known deferrals that were never scheduled

PR #97 (*Harden owner-scoped listing media storage*) states plainly:

> *"temporary legacy KYC/handover path compatibility remains for already-released mobile clients"*

Two problems with that:

1. **The premise was wrong.** There are no already-released mobile clients — the app has never
   shipped. The exception was protecting nobody while holding the public write path open.
2. **"Temporary" had no date.** It survived from 19 September until it was found this week.

A deferral without an owner and a date is not a deferral; it is an unrecorded acceptance of
risk.

### 2.4 Structural cause

`nest build` uses SWC, which strips types without checking them. The backend compiled and
deployed cleanly with 34 type errors present — including two that caused live 500s. CI ran
tests but never ran `tsc`.

This is why several findings were invisible: the tooling reported success. A CI typecheck gate
has been added (`npm run typecheck`, gating deploy).

---

## 3. Validation of PR #110 against "KYC documents are publicly accessible"

**Verdict: does not close the finding. Different subsystem.**

| | PR #110 | The KYC finding |
|---|---|---|
| Subsystem | TradeXchange service operations | Dealer onboarding / KYC |
| Files | `service-operations.service.ts` + controller | `KycOverlayForm.tsx`, `dealers.service.ts` |
| Bucket created | `tradexchange-documents` | needed `dealer-kyc-documents` |
| Production data affected | **0 rows, 0 objects** (its own words) | **43 live identity documents** |
| Migration of existing data | explicitly "not required" | required — and never ran |

### What PR #110 did well

Judged on its own terms it is a good piece of work, and its pattern was worth reusing:
service-role-only uploads, server-generated object keys, 10 MB cap, MIME + extension + byte
size + **magic-byte** validation, private `storagePath` instead of a public URL, 10-minute
signed URLs issued only after authorization, and rejection of client-supplied URLs.

The dealer KYC and handover fixes built in this engagement deliberately follow the same shape,
so the codebase now has one consistent private-document pattern rather than three.

### What it did not do

It did not touch dealer KYC, and its "no migration required" conclusion — correct for
TradeXchange — did not hold for KYC, where 43 objects needed moving. A reader who trusted the
title would have closed a critical finding that was still fully open.

---

## 4. Roadmap

### Phase 1 — do now

| # | Item | Why | Owner |
|---|---|---|---|
| 1.1 | **Rotate the Postgres password** and purge it from git history in all three public repos | The only Critical still open. Live credential, public repos. Rotation first; history rewrite second. | Client / infra |
| 1.2 | **Decide the data-protection position** on 43 identity documents + 1 signed handover PDF having been publicly reachable | UK GDPR assessment runs from *awareness*, not remediation. Closing the hole did not stop this clock. Needs a documented decision either way. | Client / DPO |
| 1.3 | **Retention decision on 17 quarantined KYC orphans** in `dealer-kyc-documents/orphaned/` | Abandoned uploads, now private. Keep or delete — but decide, don't leave them. | Client |

### Phase 2 — next

| # | Item | Why |
|---|---|---|
| 2.1 | Sweep the remaining `uploadImage(file, 'listings', …)` call sites | 11 remain. Most are legitimately public (vehicle photos, blog, marketing). `admin-messages` is empty today but its composer can attach arbitrary files to a public bucket — the same latent class. |
| 2.2 | Put a date on every "temporary" carve-out, or remove it | §2.3. Currently none have owners or dates. |
| 2.3 | Remove the now-unused URL-based handover route | Nothing calls it since both web and mobile post files. Confirm in staging, then delete. |
| 2.4 | Finish the staging environment | Vercel Preview env vars are unset, and the Supabase keys have **no fallback** — auth dies without them. Also needs `ALLOWED_ORIGINS` on Fly and a Supabase redirect wildcard. |
| 2.5 | Remove the dead `qcqnllehtuczgammazwi` Supabase URL from source | Does not resolve. A script pointed at the wrong project fails confusingly. |

### Standing changes to how this is verified

- Reconcile findings against **files and live data**, never PR titles (§2.2).
- CI now gates on `tsc --noEmit`; keep it.
- Boot `dist/main` locally before every deploy — this caught a crash-loop that tests and the
  build both missed.
- `git fetch` immediately before deploying, not just before pushing.

---

## Findings baseline

The "master audit" referenced throughout is the set of findings raised and confirmed during
this engagement, each verified against production rather than inferred from code reading.
Items 1–9 in §1 were fixed and independently verified — for the storage findings, by
anonymous fetch returning 400 and by a re-audit returning 0 objects, not by trusting the
remediation script's own summary.
