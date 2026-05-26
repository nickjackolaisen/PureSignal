# Chrome Web Store Submission Checklist

Use this when executing the `cws-submit` launch task.

## Package

1. Regenerate rules at production scale:
   ```bash
   CG_MAX_RULES=100000 CG_CHUNK_SIZE=30000 node extension/scripts/generate-core-rules.mjs
   node extension/scripts/generate-safebrowsing-rules.mjs
   node extension/scripts/generate-icons.mjs
   ```
2. Build ZIP via GitHub Actions (tag `extension-v1.0.0`) or locally:
   ```bash
   cd extension && zip -r ../puresignal-extension.zip . -x "*.DS_Store" -x "_metadata/*"
   ```
3. Confirm `manifest.json` includes icons and matches [`docs/store-listing-copy.md`](store-listing-copy.md) title.

## Listing assets (create manually)

- [ ] 3–5 screenshots (1280×800 or 640×400): popup, blocked page, options, dashboard pairing, pricing
- [ ] 128×128 icon (from `extension/icons/icon128.png`)
- [ ] 440×280 promo tile (optional)
- [ ] Short + full description from `store-listing-copy.md`

## URLs (must resolve publicly)

- Privacy: `https://puresignal.io/legal#privacy`
- Support: `https://puresignal.io/support`

## Permissions justification

See [`docs/web-store-compliance.md`](web-store-compliance.md). Explain `<all_urls>` as required for declarativeNetRequest site blocking.

## After approval

1. Set `NEXT_PUBLIC_CHROME_STORE_URL` on Vercel to the public listing URL
2. Redeploy web so home page shows the install button
