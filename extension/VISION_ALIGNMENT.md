# PureSignal Vision Alignment

This extension implementation is aligned to a "serious recovery + focus" vision while staying realistic about Chrome extension constraints.

## Implemented

- Manifest V3 + `declarativeNetRequest` static/dynamic rules.
- Large blocklist pipeline from local `hosts00` to `hosts05`.
- Redirect-to-blocked-page UX with urge logging.
- Keyword blocking (optional toggle due to false-positive risk).
- Whitelist with 24-hour friction using higher-priority `allow` dynamic rules.
- Password-gated settings changes (PBKDF2 hash via `crypto.subtle`).
- Accountability webhook for high-risk events.
- 30-minute cooldown disable flow:
  - disable request requires reason
  - timer enforced in background service worker
  - optional partner alert when requested and when disable completes
- Streaks and blocked-attempt stats in popup.
- Safe-search redirect rules generated from `safebrowsing`.

## Practical constraints (Chrome)

- Extensions cannot reliably prevent uninstall/disable by a determined user.
- "Stealth mode" cannot truly hide an installed extension from Chrome UI.
- Screenshot capture on risky actions is best-effort only and permission/context dependent.
- Static rules are package-based; full remote replacement requires extension updates or smaller dynamic deltas.

## Positioning guidance

- Product/store language should focus on productivity, focus, digital wellbeing, and accountability.
- Avoid medical claims or "cure addiction" statements.
- Explicitly disclose partner notifications and any screenshot capture.
