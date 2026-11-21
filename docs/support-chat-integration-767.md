# Secure automated customer chat support — #767

Status: design specification only. Do not enable automated chat sending from this document.

## Goal
Extend the existing hourly CarMazium Customer Support process to Admin Messages without bypassing application permissions or exposing customer data.

## Backend contract (to implement using existing chat service)

- Dedicated service principal, restricted to support conversations, authenticated server-to-server. No public or client-side service token.
- `GET /internal/support/conversations?cursor=...` returns support-room IDs, latest message ID, sender classification, answered/closed state and pagination. Enforce service-principal authorisation, tenant isolation and least privilege.
- `GET /internal/support/conversations/:roomId` returns ordered message history and authorised listing context, excluding internal notes not intended for the support agent.
- `POST /internal/support/conversations/:roomId/replies` accepts `{inReplyToMessageId, idempotencyKey, content}`. Atomically reject stale inbound messages, duplicate idempotency keys, closed rooms, human-taken-over rooms and unsupported room contexts. Use existing chat service to create messages, fire normal notifications and write immutable audit events. Return created message ID and delivery status.
- No raw SQL inserts into `messages`, sender spoofing or privileged blanket database writes.

## Support rules
- Answer routine questions only after reading full conversation and verifying account/listing facts.
- Reversible listing edits must use separately authorised existing admin workflows and be read-back verified.
- Escalate high-risk matters once by email to afaqiftikhar@gmail.com with `[CarMazium Support Approval]`; await owner instructions.
- Never autonomously transfer money, refund, approve KYC, alter account roles, delete accounts or make legal admissions.
- Distinguish auction free listing, £125 auction buyer fee, £1 retail listing, £100 seller incentive after approved handover, and direct dealer-to-seller vehicle payments.

## Rollout and acceptance
1. Inspect current chat service, role model and notification/audit code before implementing endpoints.
2. Add explicit service-principal authorisation, rate limits, logging without secrets, and per-room access controls.
3. Tests: unauthorised access, cross-room isolation, race with human reply, duplicate/retry, stale message, closed room, notification and audit delivery.
4. Feature flag defaults OFF; run a controlled test-room conversation and verify response appears in Admin Messages and customer view.
5. Only after deployment and tool exposure to the scheduled assistant may the hourly automation send chat replies. Until then, it remains read-only and escalates when needed.
