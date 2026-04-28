# PureSignal Launch Control Sheet

This is the executable version of launch tasks for engineering and operations. Fill all placeholders, then run the verification checks in order.

## 1) Provider and URL lock

- Web host: `TODO`
- API host: `TODO`
- Auth provider: `TODO`
- Email provider: `TODO`
- Support queue: `TODO`
- Status page provider: `TODO`
- Production web URL: `https://puresignal.io`
- Production API URL: `https://api.puresignal.io`
- Support URL: `TODO`
- Status URL: `TODO`

Pass checks:
- All provider choices are recorded in one document.
- DNS targets exist for `puresignal.io`, `api.puresignal.io`, support, and status hosts.

## 2) Secrets and deployment

Copy from env examples:
- API: `platform-api/.env.example`
- Web: `web/.env.example`

Pass checks:
- No secrets committed to git.
- API health checks return 200:
  - `GET /health`
  - `GET /v1/status`
- Web dashboard can load and call API from browser without CORS errors.

## 3) Stripe production wiring

Required live price IDs:
- `STRIPE_PRICE_EXT_PRO_MONTHLY`
- `STRIPE_PRICE_EXT_PRO_ANNUAL`
- `STRIPE_PRICE_DESKTOP_PRO_MONTHLY`
- `STRIPE_PRICE_DESKTOP_PRO_ANNUAL`
- `STRIPE_PRICE_BUNDLE_PRO_MONTHLY`
- `STRIPE_PRICE_BUNDLE_PRO_ANNUAL`

Pass checks:
- `POST /v1/billing/create-checkout` succeeds with `{ planCode, interval }`.
- Stripe webhook endpoint points to `POST /v1/billing/webhook`.
- Invalid Stripe signature returns HTTP 400.
- Valid checkout event updates `subscription` and `entitlement`.

## 4) Auth production hardening

Current web auth uses signed session cookies and deterministic user IDs.

Pass checks:
- Cookie is HTTP-only and secure in production.
- Protected routes redirect unauthenticated users.
- Dashboard API rejects invalid/expired session token.

## 5) Extension production hardening

Pass checks:
- Signed manifest path configured in extension settings.
- JWK public key embedded/configured for verification.
- Tampered manifest or delta payload is rejected.
- Last known good delta restores after a failed fetch.

## 6) Store and legal package

Required docs:
- Listing copy: `docs/store-listing-copy.md`
- Store compliance: `docs/web-store-compliance.md`
- Terms: `legal/terms-of-service.md`
- Privacy: `legal/privacy-policy.md`
- Cookies: `legal/cookie-policy.md`

Pass checks:
- Listing text only makes policy-safe claims.
- Privacy/support URLs in store listing resolve publicly.
- Counsel signoff recorded or draft waiver recorded.

## 7) Final QA gate

Use `docs/qa-release-matrix.md` and complete every scenario before submission.
