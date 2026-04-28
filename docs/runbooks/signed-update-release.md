# Runbook: Signed Update Release

## Goal

Publish a blocklist manifest and delta payload that the extension can verify with a JWK public key.

## Required values

- Manifest URL served to extension (`signedManifestUrl` in extension settings).
- JWK public key copied to extension settings (`manifestPublicKeyJwk`).
- API env: `BLOCKLIST_MANIFEST_SIGNATURE` populated for `/v1/blocklist/manifest`.

## Release flow

1. Generate/refresh delta payload JSON:
   - include `domains: string[]`
2. Sign the canonical payload bytes used by extension:
   - Manifest signature verifies payload with keys:
     - `version`
     - `artifactUrls`
     - `sha256`
     - `minClientVersion`
   - Delta signature verifies payload with key:
     - `domains`
3. Upload manifest and delta artifacts.
4. Set `BLOCKLIST_MANIFEST_SIGNATURE` in API secret manager.
5. Roll out and monitor update alarm executions.

## Rollback checks

- Break signature intentionally in staging.
- Confirm extension rejects invalid payload.
- Confirm extension reapplies `lastGoodDeltaDomains`.
- Restore valid signature and confirm sync success.
