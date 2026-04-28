# Runbook: Production Deploy Checklist

## Inputs required

- `docs/provider-decision-record.md` completed.
- `platform-api/.env.example` and `web/.env.example` values present in your secret manager.
- Production database available and reachable by `DATABASE_URL`.

## Deploy API

1. Build and release `platform-api`.
2. Run Prisma migration deploy step:
   - `npx prisma migrate deploy`
3. Confirm API health:
   - `GET /health`
   - `GET /v1/status`

## Deploy web

1. Build and release `web`.
2. Confirm `NEXT_PUBLIC_API_BASE_URL` points to the production API URL.
3. Verify routes:
   - `/`
   - `/pricing`
   - `/dashboard` redirects when not authenticated

## Automated post-deploy check

Run:

`API_BASE_URL=https://api.puresignal.io WEB_BASE_URL=https://puresignal.io node scripts/verify-release-health.mjs`

Pass criteria:
- All checks report `OK`.
- No CORS errors in browser console when web calls API.

## Billing verification

- Stripe webhook endpoint configured to `POST /v1/billing/webhook`.
- Invalid signature test returns `400`.
- Successful checkout updates `subscription` and `entitlement`.
