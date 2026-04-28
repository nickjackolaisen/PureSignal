# Auth Integration Notes

Current implementation in `web/` now uses signed session cookies and deterministic user IDs.

## Session behavior

- Cookie name: `SESSION_COOKIE_NAME` (default `ps_session`).
- Cookie payload is signed with `AUTH_SESSION_SECRET` and includes `sub`, `email`, `provider`, `iat`, `exp`.
- Dashboard and protected routes require a valid session.

## Stable user ID contract

User IDs are derived from:

`createUserId(provider + ":" + sub)`

This ensures Stripe `client_reference_id` and entitlement lookups stay stable across requests.

## Provider handoff

Use one of these approaches:

1. Keep `AUTH_MODE=demo` until provider is ready.
2. For an external identity proxy, pass `externalUserId` and `provider` to login route.
3. Replace login route with direct callback handling for your provider and keep the same `sub/email/provider` session contract.
