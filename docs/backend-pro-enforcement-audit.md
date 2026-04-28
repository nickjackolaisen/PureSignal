# Backend Pro Enforcement Audit

This file tracks server-side checks that enforce paid features independently of UI state.

## Enforced in API

- `POST /v1/alerts`
  - Requires paid entitlement with `partnerRelay=true`.
  - Returns `403` on free plan.
- Stripe webhook updates subscriptions and entitlements:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

## Verification checklist

- Free user request to `/v1/alerts` is denied (403).
- Active `ext_pro` or `bundle_pro` user can enqueue alerts (202).
- Downgrade or cancel flips entitlement flags to free feature set.
- Dashboard reflects server entitlements from `/v1/entitlements`.
