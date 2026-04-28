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

## Production URLs for submission

- Privacy policy: `https://puresignal.io/legal`
- Support: `https://puresignal.io/support`
- Terms: `https://puresignal.io/legal`
- Status page: `TODO`

## Submission evidence

- Data use questionnaire completed and reviewed against this file.
- Final listing text reviewed against `docs/store-listing-copy.md`.
- Video and screenshots represent current extension UI and behavior.
