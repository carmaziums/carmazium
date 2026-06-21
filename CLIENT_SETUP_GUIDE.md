# CarMazium — Client Setup Guide

This document covers the two things only you have access to: your **domain DNS** and your **Stripe account**. Once these are done, the development team will handle everything else on their end.

---

## 1. Domain DNS Setup

You need to add two DNS records for `carmazium.co.uk`. These are set in your **domain registrar** (e.g. GoDaddy, Namecheap, 123-reg, Google Domains — wherever you purchased the domain).

Log in to your registrar → find the **DNS Records** or **DNS Management** section for `carmazium.co.uk`, then add the following:

| Type  | Name / Host | Value                               |
|-------|-------------|-------------------------------------|
| A     | `@`         | `216.198.79.1`                      |
| CNAME | `www`       | `a67967c4543e4579.vercel-dns-017.com` |

**Notes:**
- The `@` symbol means the root domain (`carmazium.co.uk` with no prefix)
- Some registrars label "Name / Host" as "Hostname" or "Record Name"
- If a conflicting A record for `@` already exists, replace it with the new one
- DNS changes can take **up to 24–48 hours** to fully propagate, though it's usually under 30 minutes

Once done, let the development team know — they will verify it from their end.

---

## 2. Stripe Webhook

A webhook is how Stripe notifies the website when a payment is completed. You need to add one for the live domain.

**Steps:**

1. Log in to your Stripe Dashboard at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Developers → Webhooks** (top-right corner → Developers)
3. Click **+ Add endpoint**
4. Set the **Endpoint URL** to:
   ```
   https://www.carmazium.co.uk/api/webhooks/stripe
   ```
5. Under **Events to listen to**, select the following:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click **Add endpoint**
7. On the next screen, click **Reveal** next to **Signing secret**
8. Copy that secret (it starts with `whsec_...`) and send it securely to the development team

> **Important:** Do not share the signing secret over email or messaging apps. Use a secure method such as a password manager share link or an encrypted note.

---

## Summary Checklist

- [ ] Add A record: `@` → `216.198.79.1`
- [ ] Add CNAME record: `www` → `a67967c4543e4579.vercel-dns-017.com`
- [ ] Notify dev team that DNS is updated
- [ ] Add Stripe webhook endpoint for `https://www.carmazium.co.uk/api/webhooks/stripe`
- [ ] Share the Stripe webhook signing secret securely with the dev team

---

If you have any questions at any step, reach out to the development team before making changes.
