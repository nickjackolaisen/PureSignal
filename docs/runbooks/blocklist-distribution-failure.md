# Runbook: Blocklist Distribution Failure

## Trigger

- Extension/desktop sync errors spike.
- Manifest endpoint returns stale or invalid data.

## Immediate actions

1. Verify latest blocklist artifact exists and is accessible on CDN.
2. Validate manifest hash and signature values.
3. Roll back to prior known-good release manifest if needed.

## Recovery checklist

- Confirm sync success from telemetry samples.
- Verify extension and desktop clients accept new manifest.
- Document root cause and update signing/build guardrails.
