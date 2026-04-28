# PureSignal Feature Matrix

## Plans

- `free`
- `ext_pro`
- `desktop_pro`
- `bundle_pro`

## Entitlement flags

- `partnerRelay`
- `advancedAnalytics`
- `signedUpdates`
- `cloudSync`
- `desktopAdvanced`
- `prioritySupport`

## Extension features by plan

| Feature | free | ext_pro | desktop_pro | bundle_pro |
|---|---|---|---|---|
| Core blocklist | yes | yes | yes | yes |
| Basic keywords | yes | yes | yes | yes |
| Basic whitelist | yes | yes | yes | yes |
| Advanced analytics | no | yes | no | yes |
| Partner relay | no | yes | no | yes |
| Signed update channels | no | yes | no | yes |
| Cloud settings sync | no | yes | no | yes |
| Priority support | no | yes | no | yes |

## Desktop features by plan

| Feature | free | ext_pro | desktop_pro | bundle_pro |
|---|---|---|---|---|
| Hosts baseline blocker | yes | yes | yes | yes |
| Local stats | yes | yes | yes | yes |
| Desktop advanced controls | no | no | yes | yes |
| Desktop cloud sync | no | no | yes | yes |
| Category packs | no | no | yes | yes |

## Server enforcement rule

Premium endpoints must check plan and flags server-side. Client UI gating is secondary.
