# Engineering Standards

## Repository standards

- Use feature branches and pull requests for all changes.
- Require CI checks before merge.
- Keep production secrets outside git.

## CI baseline checks

- Lint
- Unit tests
- Build
- Secret scanning
- Dependency vulnerability scan

## Logging and observability

- Structured JSON logs in backend services.
- Attach stable `errorId` to every user-visible error.
- Never log raw credentials, card data, or full URL histories.

## Redaction rules

- Hash or truncate tokens and identifiers where practical.
- Remove query strings from URL-like values unless explicitly required.
- Store only minimal metadata for alert events.

## Incident readiness

- Publish status page updates for production incidents.
- Keep runbooks for API outage, payment failure, and blocklist distribution failure.
