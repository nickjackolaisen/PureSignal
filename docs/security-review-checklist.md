# Security Review Checklist

## Extension

- Verify API token handling and storage scope.
- Validate entitlement checks for premium actions.
- Verify signature checks for manifest and delta payloads.
- Test downgrade behavior and premium feature lockout.

## API

- Verify Stripe webhook signature handling.
- Verify alert endpoint rate limiting and abuse controls.
- Ensure payload redaction rules are consistently applied.
- Validate auth/session protections on dashboard APIs.

## Operations

- Rotate secrets and confirm vault-backed delivery.
- Validate incident runbooks in staging.
- Confirm backup restore drill success.
