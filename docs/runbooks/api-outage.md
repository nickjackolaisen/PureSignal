# Runbook: API Outage

## Trigger

- Elevated 5xx rate or healthcheck failures.

## Immediate actions

1. Confirm outage scope via `/health` and infrastructure metrics.
2. Announce investigation on status page.
3. Roll back latest deployment if issue started immediately after release.
4. Enable degraded mode for non-critical endpoints.

## Recovery checklist

- Validate `/v1/entitlements`, `/v1/alerts`, and `/v1/blocklist/manifest`.
- Confirm database connectivity and migration status.
- Post incident summary with timeline and customer impact.
