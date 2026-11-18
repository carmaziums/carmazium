# MaziuM conversational assistant upgrade

## Verified causes

The official support worker passed only the newest message to a separate gpt-4o-mini prompt with 250 output tokens. Broad fixed-answer regexes intercepted multi-part questions. Public chat retained only ten turns and had no authenticated tools. A previous auction reply also incorrectly promised everyone visibility of guarded trade inventory.

## Implementation

Both surfaces now use one conversational engine. The default candidate is gpt-6.2-sol through Responses, low reasoning effort, with encrypted reasoning continuity across bounded tool rounds and store:false. OPENAI_MAZIUM_CHAT_MODEL remains configurable; explicitly configured older models use a compatibility Chat Completions path. There is no silent downgrade. The latest 40 messages / 24,000 characters are retained; this is bounded context, not unlimited persistent memory. Official support reads its actual room transcript through membership checks and excludes earlier sensitive messages.

Model-selected knowledge retrieval covers the 26 existing source-linked workflow topics. Relevant deterministic retrieval primes context but no longer chooses the customer's answer. CI fingerprints 50 source files: a source change fails until its facts have been reviewed and the manifest updated. This prevents silent knowledge drift; it deliberately does not invent updated policy from code changes. Catalogue edits deploy with the application.

Read-only tools use authenticated server identity, never a supplied customer ID. They check dealer permissions, ten recent owned listings, and ten recent personally owned auction bonus records. Dealer stock uses existing staff inventory permissions. Personal bonus records never inherit the dealership owner identity. There is no admin cross-customer bypass. Bank details, private documents, contact details, payment credentials and private message bodies are absent from results. Stripe onboarding is a saved database flag, not a direct live Stripe API check. Recorded transfer is not bank settlement. Missing results are bounded and must not be described as proof that a listing never existed.

No automated bidding, cancellation, refunds, payouts or account mutations are added. Existing official support handoff, opt-outs, staff takeover, atomic persistence and race checks remain in force. Routine bonus status questions are now eligible for read-only assistance; requests to pay/release money still require staff.

The web widget has default-on AI with a persistent pause, concise greeting, 40-turn context, viewport/keyboard sizing, wrapped messages, contained scrolling, initial-only suggestions, one close control, and private conversation reset on identity changes. Native binaries retain their existing UI/privacy controls; the shared backend improves native answers without claiming a new native release.

## Evaluation and release gates

120 distinct synthetic conversations plus 5 authenticated fixture conversations cover permissions, fees, reserves, cancellation, bonus, Stripe, finance, warranties, caravan, valuations, listings, services, false premises and follow-ups. The candidate model is run inside a temporary directory using the existing API credential without instantiating Prisma or reading production customer records. Failed contract checks block Fly deployment. Full generated answers are retained for manual review; regex contract success alone is not proof of semantic accuracy.

Additional unit tests cover ownership, role permissions, deleted accounts, anonymous access, injected user IDs, forbidden operations, payout stages, redaction, bounded history, Responses tool execution and lookup failures. Existing PostgreSQL integration checks remain a release gate. Production health readiness is not model correctness: confirm version, real responses and desktop/mobile UI separately.

## Existing implementation discrepancies requiring owner review

- Valuation code sets retail to auction × 1.20. This is not mathematically equivalent to setting auction to retail × 0.80. No valuation calculation was changed.
- Current warranty code offers repair limits £1,000/£2,000 and labour £75/£100/£150/£200. Earlier requested £5,000 / £125 options are not in that implementation. No tariff or option was changed.
- Towable caravans support manual listing and one photo. Motorised campervans currently follow motor vehicle requirements and ten photos. No listing validation rules were changed.

## Known scope limits

Authenticated lookups cover the described records, not every finance application, warranty policy, service job or provider account. There is no bank settlement verification and no unrestricted account operating agent. The model still needs ongoing evaluation and production monitoring. No claim of model training, universal correctness or a measured customer-resolution percentage is made.

Deployment and final evaluation results will be recorded after the gated run and production checks.

## First real-model run

Run 44418319456 produced 125 answers: 120 contract passes. Manual review found four correct answers rejected by narrow lexical assertions (MZ-009/024/054/084), and one real failure (MZ-101): a broad cross-sentence auction guard replaced a multi-service answer with a short eligibility paragraph. The guard now scopes claims to clauses, and suspected policy/route errors receive one contextual model repair preserving every question part and tool evidence. Repeated failure still blocks delivery. The four assertions accept equivalent correct wording without removing their factual requirements. All 125 answers were reviewed; authenticated fixture responses correctly distinguished permissions, pending review, payout approval and saved Stripe onboarding. A full rerun remains required.

Second run 44420732683: 124/125 contract passes. The genuine multi-part failure was resolved. MZ-005 correctly refused private-account bidding on behalf of a dealer uncle and explained authorised staff roles; the test incorrectly demanded retail shopping advice despite that business context. Its assertion now requires refusal, private-account context and verified/authorised dealership access. Deployment stayed blocked pending another full run.

Manual review additionally tightened ambiguous £1 explanations: distinguish Basic Retail advertising from the separate dealer verification charge instead of assuming the customer means verification. MZ-101 now explicitly requires the advertising distinction as well as retail, finance and warranty.

Integrated concurrent support-context release #901 without dropping its safer yes/no handoff handling, navigation improvements, sensitive-content boundaries or support answer validation. All 50 source fingerprints were reviewed for the combined revision.

The floating assistant also renders formatted answers and clickable same-site links with HTML/images excluded and unrelated link origins rendered as plain text. This matches the richer support response presentation while retaining safe navigation.
