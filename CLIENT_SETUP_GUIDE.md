# CarMazium — Client Setup Guide

This document covers the two things only you have access to: your **domain DNS** (at IONOS) and your **Stripe account**. Once these are done, the development team will handle everything else on their end.

---

## 1. Domain DNS Setup

You need to add two DNS records for `carmazium.com`. These are set at **IONOS**, where the domain is registered.

Log in to IONOS → find the **DNS** section for `carmazium.com`, then add the following (values as issued by Vercel):

| Type  | Name / Host | Value                               |
|-------|-------------|-------------------------------------|
| A     | `@`         | `216.198.79.1`                      |
| CNAME | `www`       | `a67967c4543e4579.vercel-dns-017.com` |

**Notes:**
- The `@` symbol means the root domain (`carmazium.com` with no prefix)
- IONOS may label "Name / Host" as "Hostname" or "Record Name"
- If a conflicting A record for `@` already exists, replace it with the new one
- DNS changes can take **up to 24–48 hours** to fully propagate, though it's usually under 30 minutes

Once done, let the development team know — they will verify it from their end (Vercel's domain dashboard shows "Valid Configuration" once DNS resolves correctly).

---

## 2. Stripe Webhook

A webhook is how Stripe notifies the website when a payment is completed. You need to add one for the live domain.

**Important:** the webhook must point at the **backend API** (Fly.io), not the website itself — the website has no webhook endpoint. Payment confirmations, listing activation, and payouts will silently stop working if this points at the wrong URL.

**Steps:**

1. Log in to your Stripe Dashboard at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Developers → Webhooks** (top-right corner → Developers)
3. Click **+ Add endpoint**
4. Set the **Endpoint URL** to:
   ```
   https://carmazium-hjoh9w.fly.dev/payments/webhook
   ```
5. Under **Events to listen to**, select the following:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `account.updated`
6. Click **Add endpoint**
7. On the next screen, click **Reveal** next to **Signing secret**
8. Copy that secret (it starts with `whsec_...`) and send it securely to the development team

> **Important:** Do not share the signing secret over email or messaging apps. Use a secure method such as a password manager share link or an encrypted note.

---

## Summary Checklist

- [ ] Add A record: `@` → `216.198.79.1`
- [ ] Add CNAME record: `www` → `a67967c4543e4579.vercel-dns-017.com`
- [ ] Notify dev team that DNS is updated
- [ ] Add Stripe webhook endpoint for `https://carmazium-hjoh9w.fly.dev/payments/webhook`
- [ ] Share the Stripe webhook signing secret securely with the dev team

---

If you have any questions at any step, reach out to the development team before making changes.
