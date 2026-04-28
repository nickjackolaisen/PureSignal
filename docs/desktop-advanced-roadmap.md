# Desktop Advanced Roadmap (Post-MVP)

## Optional TLS proxy mode

### Goals

- Detect and block content patterns beyond domain-level matching.
- Provide optional premium mode for users who explicitly opt in.

### Requirements

- Local root certificate installation and management.
- Transparent consent flow with clear risk explanation.
- Compatibility testing matrix across major browsers and OS versions.
- Fast rollback path to hosts-only mode.

### Safety gates before release

- Dedicated support runbook and escalation process.
- Canary rollout with feature flag.
- Independent security review of certificate handling.

## Extra category SKUs

- Categories: social, gambling, streaming, custom productivity bundles.
- Per-category ruleset channels in manifest and desktop update manifest.
- Plan-based entitlements from `/v1/entitlements`.

## Enterprise and MDM path

- Configuration profiles for managed rollout.
- Team admin console (policy templates, device posture, audit export).
- Data retention and residency controls for enterprise plans.
