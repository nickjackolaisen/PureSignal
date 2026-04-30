# PureSignal extension

## “Could not load manifest” / invalid `rules/blocklist_core_*.json`

The manifest lists static Declarative Net Request rule files under `rules/`. In a full dev setup those files are **generated** from the repo `hosts00`–`hosts05` lists.

This repo ships **small placeholder** `blocklist_core_01.json`–`04.json` files so Chrome can load the extension immediately. They only match a non-existent domain (`puresignal-placeholder.invalid`) until you generate the real blocklist.

### Generate the real blocklist (from repo root)

```bash
CG_MAX_RULES=100000 CG_CHUNK_SIZE=30000 node extension/scripts/generate-core-rules.mjs
node extension/scripts/generate-safebrowsing-rules.mjs
```

Then reload the extension in `chrome://extensions`. The script rewrites `manifest.json` rule entries to match how many chunk files it produced (not always four).

### Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` directory

### Chrome Web Store / ZIP uploads

Do not include a `_metadata` folder (Chrome creates it when you pack an extension locally). Delete it before zipping, or use the repo’s CI artifact. Packaging with `_metadata` often causes upload or review errors.
