# PureSignal Launch Control Sheet

This is the executable version of launch tasks for engineering and operations. Fill all placeholders, then run the verification checks in order.

## 1) Provider and URL lock

- Web host: `Vercel`
- API host: `Render`
- Auth provider: `Demo (cookie-based session)` — upgrade to OAuth as needed
- Email provider: `TBD` — not implemented yet
- Support queue: `support@puresignal.io` or form at `/support`
- Status page provider: `TBD` — optional BetterUptime or similar
- Production web URL: `https://puresignal.io`
- Production API URL: `https://api.puresignal.io` (or Render subdomain if custom domain not configured)
- Support URL: `https://puresignal.io/support`
- Status URL: `TBD`

Pass checks:
- All provider choices are recorded in one document.
- DNS targets exist for `puresignal.io` (Vercel) and `api.puresignal.io` (Render CNAME) or use Render subdomain directly.

## 2) Secrets and deployment

### API (Render) — from `platform-api/.env.example`

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase Session pooler URI (port 5432) |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://puresignal.io` (production web) |
| `STRIPE_SECRET_KEY` | Yes | `sk_live_...` for production |
| `STRIPE_WEBHOOK_SECRET` | Yes | Dashboard signing secret from Stripe → Webhooks |
| `STRIPE_PRICE_*` | Yes | Six live price IDs (see .env.example) |
| `BLOCKLIST_PUBLIC_KEY_JWK` | Yes | ECDSA P-256 public key for extension verification |

Build command: `npm install && npm run build`
Start command: `npm start`

### Web (Vercel) — from `web/.env.example`

| Variable | Required | Notes |
|----------|----------|-------|
| `API_URL` | Yes | Internal API URL for server-side routes |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Public API URL (same as API_URL typically) |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://puresignal.io` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | `pk_live_...` for production |
| `AUTH_SESSION_SECRET` | Yes | 32+ char random string |

Pass checks:
- No secrets committed to git.
- API health checks return 200:
  - `GET /health`
  - `GET /v1/status`
- Web dashboard can load and call API from browser without CORS errors.

## 3) Stripe production wiring

### Required env vars on API (Render)

**Live price IDs** (create in Stripe Dashboard → Products → Add price):
- `STRIPE_PRICE_EXT_PRO_MONTHLY` — Chrome extension monthly
- `STRIPE_PRICE_EXT_PRO_YEARLY` — Chrome extension annual
- `STRIPE_PRICE_DESKTOP_PRO_MONTHLY` — Desktop app monthly
- `STRIPE_PRICE_DESKTOP_PRO_YEARLY` — Desktop app annual
- `STRIPE_PRICE_BUNDLE_PRO_MONTHLY` — Bundle monthly
- `STRIPE_PRICE_BUNDLE_PRO_YEARLY` — Bundle annual

**Webhook secret**:
- `STRIPE_WEBHOOK_SECRET` — Dashboard signing secret from Stripe → Developers → Webhooks → your endpoint

### Webhook setup in Stripe Dashboard

1. Go to Stripe → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://api.puresignal.io/v1/billing/webhook` (or your Render subdomain)
3. Events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the signing secret (starts with `whsec_`) to `STRIPE_WEBHOOK_SECRET` on Render

### Verification checklist

| Step | Command / Action | Expected |
|------|------------------|----------|
| 1 | `GET /health` | Returns `secretKeyMode: "live"` and `priceAndWebhookMode: "live"` |
| 2 | `GET /debug/prices` | Shows all 6 resolved price IDs |
| 3 | `POST /v1/billing/create-checkout` with `{ userId, planCode: "chrome", interval: "monthly", successUrl, cancelUrl }` | Returns `checkoutUrl` |
| 4 | Complete test checkout in browser | Redirects to success URL |
| 5 | Check Stripe Dashboard → Webhooks → Recent events | `checkout.session.completed` shows 200 |
| 6 | `GET /v1/entitlements?userId=<your-id>` | Returns `planCode: "ext_pro"` |
| 7 | Send request with invalid signature | Returns HTTP 400 |

### Troubleshooting

- **400 on webhook**: Check `STRIPE_WEBHOOK_SECRET` matches the endpoint in Stripe Dashboard (not CLI secret)
- **Price not found**: Verify price IDs exist in the same Stripe account as the API key mode (test vs live)
- **Customer missing**: The API upserts users on webhook; check API logs for DB errors
## 4) Auth production hardening

Current web auth uses signed session cookies and deterministic user IDs.

Pass checks:
- Cookie is HTTP-only and secure in production.
- Protected routes redirect unauthenticated users.
- Dashboard API rejects invalid/expired session token.

## 5) Extension production hardening

### Blocklist signing key pair

Generate once and store securely:

```bash
node -e '
const crypto = require("crypto");
(async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, ["sign", "verify"]
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  delete publicJwk.d;
  console.log("Private (BLOCKLIST_SIGNING_KEY):", JSON.stringify(privateJwk));
  console.log("Public (BLOCKLIST_PUBLIC_KEY_JWK):", JSON.stringify(publicJwk));
})();
'
```

**Current production keys (example):**
- Public key in `extension/background.js` `DEFAULT_MANIFEST_PUBLIC_KEY_JWK`
- Public key in `platform-api/.env.example` `BLOCKLIST_PUBLIC_KEY_JWK`
- Private key: store as GitHub Actions secret `BLOCKLIST_SIGNING_KEY`

### Publishing a blocklist release

Requires R2 credentials (set as GitHub Actions secrets):

```bash
BLOCKLIST_SIGNING_KEY='{"kty":"EC",...}' \
R2_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
R2_BUCKET=puresignal-blocklist \
R2_PUBLIC_BASE_URL=https://blocklist.puresignal.io \
node platform-api/scripts/publish-blocklist-release.mjs --version 2026.05.17
```

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
