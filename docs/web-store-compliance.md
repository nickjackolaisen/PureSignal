# Chrome Web Store Compliance Package

## Permissions justification

- `declarativeNetRequest`: core blocking engine.
- `storage`: user settings, local stats, feature flags cache.
- `alarms`: scheduled sync and cooldown timers.
- `notifications`: user-facing alert feedback.
- `tabs`: onboarding and limited extension UX actions.
- `declarativeNetRequestFeedback`: optional debug/tracking where supported.

## Data use disclosure summary

- No full browsing history collection by default.
- Optional telemetry is aggregated and redacted.
- Partner alerts are opt-in and require explicit consent.
- No selling of personal data.

## Listing assets checklist

- Screenshots of popup/options/blocked page.
- Short demo video.
- Privacy policy URL.
- Support URL.
- Accurate claims about platform limitations.
