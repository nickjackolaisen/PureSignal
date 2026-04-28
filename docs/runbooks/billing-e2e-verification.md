# Runbook: Billing E2E Verification

## Prerequisites

- API deployed with all six `STRIPE_PRICE_*` variables set.
- Stripe webhook configured to `POST /v1/billing/webhook`.
- Test user can authenticate to web and has a stable `userId`.

## 1) Confirm price wiring

Call:

`GET /v1/billing/config`

Pass criteria:
- Every plan and interval reports `true`.

## 2) Create checkout session

Call:

`POST /v1/billing/create-checkout`

Body example:

```json
{
  "userId": "user_test_001",
  "planCode": "ext_pro",
  "interval": "monthly",
  "successUrl": "https://puresignal.io/dashboard?checkout=success",
  "cancelUrl": "https://puresignal.io/pricing?checkout=cancel"
}
```

Pass criteria:
- Returns `checkoutUrl`.
- Stripe-hosted checkout loads and can complete payment.

## 3) Verify webhook updates

Expected event chain:
- `checkout.session.completed`
- `customer.subscription.updated` (or created)

Pass criteria:
- `subscription` row exists and is `active`.
- `entitlement` row for user updates to expected plan.
- `GET /v1/entitlements?userId=...` returns expected flags.

## 4) Negative verification

Pass criteria:
- Invalid signature request to webhook returns 400.
- Payment failure event sets `subscription.status` to `past_due`.
- Cancel event eventually returns plan to `free`.
