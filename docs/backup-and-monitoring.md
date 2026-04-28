# Backup and Monitoring Automation

## Database backups

- Daily full backup and 15-minute WAL or incremental snapshots.
- Weekly restore validation in staging.
- Retention: 30 daily + 12 monthly.

## Monitoring

- API health probe (`/health`) every minute.
- Entitlements latency and error-rate alert thresholds.
- Billing webhook failure alerts.
- Blocklist manifest availability checks.

## On-call routing

- Pager target for critical incidents.
- Secondary escalation after 10 minutes.
- Status page updates within 15 minutes of confirmed impact.
