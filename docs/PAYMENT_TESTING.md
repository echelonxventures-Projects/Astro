# Payment Testing (Test Mode, per platform)

Every payment setting is per tenant (`/admin/payments`). This runbook covers
testing Stripe, Razorpay and PayPal in test mode for any platform in the fleet.

## Prerequisites

- The tenant's own test credentials (do not reuse one platform's keys on another).
- `ENCRYPTION_KEY` set (gateway secrets are stored AES-256-GCM encrypted).
- Webhooks address the tenant explicitly: `/api/payment/webhook/<gw>?t=<tenant-slug>`.

## Stripe

1. Keys: https://dashboard.stripe.com/test/apikeys (`sk_test_…`).
2. Enter at `<tenant-host>/admin/payments` → Stripe (testMode on).
3. Local webhook delivery (Stripe CLI):
   ```bash
   stripe listen --forward-to http://localhost:3001/api/payment/webhook/stripe?t=luna
   # production: https://<tenant-domain>/api/payment/webhook/stripe?t=luna
   ```
   Copy the printed `whsec_…` into the tenant's webhook secret field.
4. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (declined).
5. E2E loop: sign in on the tenant host → `/pricing` → subscribe → checkout →
   confirm the pending `PaymentTransaction` appears in `/admin/payments`, then the
   `checkout.session.completed` webhook flips the local `Subscription`/user status.

## Razorpay (India markets)

1. Test keys: https://dashboard.razorpay.com/app/keys (`rzp_test_…`).
2. Webhook: create in the Razorpay dashboard pointing to
   `…/api/payment/webhook/razorpay?t=<slug>` and paste its signing secret.
3. Test card `4111 1111 1111 1111` / any UPI VPA `success@razorpay` (test mode).
4. Signature verification is constant-time HMAC-SHA256 over the raw body and is
   unit-tested (`src/lib/__tests__/webhook-signature.test.ts`).

## PayPal (sandbox)

1. Sandbox app: https://developer.paypal.com/dashboard → `PAYPAL_ENVIRONMENT=sandbox`.
2. Return URLs already include `successUrl/cancelUrl`; approve a subscription on
   sandbox and mirror the webhook to `…/webhook/paypal?t=<slug>` (PayPal simulator
   or `webhooks` forwarding tool).
3. Sandbox buyer accounts from the dashboard test the consent + billing cycles.

## Per-platform verification checklist

- [ ] Checkout renders only this tenant's enabled gateways (`/api/payment/methods`).
- [ ] Currency defaults from the tenant's default market (`/admin/localization`).
- [ ] Gateway plan mappings exist (`/admin/payments` → Gateway Plans) or plan price fallback applies.
- [ ] Webhook events land on the right tenant: check `PaymentAuditLog` rows carry `tenantId`.
- [ ] Fraud rules (`MAX_TRANSACTION_AMOUNT`, velocity checks) evaluated per tenant.
- [ ] After go-live: rotate to LIVE keys per tenant, set live webhook secrets, disable testMode.

## Gotchas

- `?t=` missing on a webhook URL → event attributed to the default tenant (host
  fallback); always register per-tenant URLs explicitly.
- Stripe webhooks fire for the account, not the browser host — the `?t=` param is
  the only routing hint. One Stripe account per tenant is strongly recommended.
- `testMode` is stored per gateway row; keys from the platform `.env` only seed
  the default tenant during provisioning.
