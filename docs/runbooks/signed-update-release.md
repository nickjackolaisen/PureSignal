# Runbook: Signed Update Release

## Goal

Publish a signed blocklist manifest and delta payload that the extension can verify with ECDSA P-256.

## Architecture

```
git tag blocklist-v2026.05.01
        │
        ▼
GitHub Actions (release-blocklist.yml)
        │
        ├─► Reads hosts00-05 + whitelist
        ├─► Signs delta with BLOCKLIST_SIGNING_KEY
        ├─► Uploads to Cloudflare R2 (blocklist.puresignal.io)
        └─► Writes BlocklistRelease row to Postgres
        
Extension fetches /v1/blocklist/manifest → R2 delta → verifies signature
```

## Required secrets (GitHub Actions)

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Postgres connection string (same as platform-api) |
| `BLOCKLIST_SIGNING_KEY` | ECDSA P-256 private JWK (single-line JSON) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET` | R2 bucket name (e.g. `puresignal-blocklist`) |
| `R2_PUBLIC_BASE_URL` | Public URL (e.g. `https://blocklist.puresignal.io`) |

## Required env vars (platform-api on Render)

| Variable | Description |
|----------|-------------|
| `BLOCKLIST_PUBLIC_KEY_JWK` | ECDSA P-256 public JWK (served by `/v1/blocklist/public-key`) |

## Release flow

### Option A: Tag push (recommended)

```bash
git tag blocklist-v2026.05.01
git push --tags
```

GitHub Actions triggers automatically, runs `publish-blocklist-release.mjs`, and uploads to R2 + DB.

### Option B: Manual workflow dispatch

1. Go to Actions > Release Blocklist > Run workflow
2. Enter version (e.g. `2026.05.01`), optional changelog
3. Optionally enable dry-run to test without uploading

### Verification

```bash
# Check API returns real manifest
curl https://puresignal-api-bpqr.onrender.com/v1/status
# Expect: blocklistVersion: "2026.05.01"

curl https://puresignal-api-bpqr.onrender.com/v1/blocklist/manifest
# Expect: version, signature, artifactUrls.delta

# Check delta artifact
curl https://blocklist.puresignal.io/deltas/v1/delta-2026.05.01.json
# Expect: { domains: [...], signature: "..." }

# Full health check
API_BASE_URL=https://puresignal-api-bpqr.onrender.com \
WEB_BASE_URL=https://puresignal.io \
node scripts/verify-release-health.mjs
```

## Rollback

If a bad release is pushed:

1. Mark the release as deprecated:
   ```sql
   UPDATE "BlocklistRelease" SET deprecated = true WHERE version = '2026.05.01';
   ```

2. The manifest endpoint returns the most recent non-deprecated release.

3. Extension falls back to `lastGoodDeltaDomains` if signature verification fails.

## Key generation (one-time setup)

Generate ECDSA P-256 key pair:

```javascript
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

const privateJwk = await crypto.subtle.exportKey('jwk', privateKey);
const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);

console.log('Private (BLOCKLIST_SIGNING_KEY):', JSON.stringify(privateJwk));
console.log('Public (BLOCKLIST_PUBLIC_KEY_JWK):', JSON.stringify(publicJwk));
```

Store private JWK as GitHub secret `BLOCKLIST_SIGNING_KEY`.
Store public JWK in:
- Render env as `BLOCKLIST_PUBLIC_KEY_JWK`
- `extension/background.js` `DEFAULT_MANIFEST_PUBLIC_KEY_JWK` (hardcoded fallback)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No blocklist release published" | No BlocklistRelease rows | Run a release |
| Extension shows "signature verification failed" | Key mismatch or corrupt signature | Verify public key matches private key used to sign |
| Delta fetch fails | R2 bucket misconfigured or not public | Check R2 custom domain settings |
| GH Actions fails at "Publish blocklist release" | Missing secrets | Check all required secrets are set |
