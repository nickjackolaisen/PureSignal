#!/usr/bin/env node

import crypto from "node:crypto";

const apiBaseUrl = process.env.API_BASE_URL;
const webBaseUrl = process.env.WEB_BASE_URL;
const skipBlocklist = process.env.SKIP_BLOCKLIST_CHECK === "true";

if (!apiBaseUrl || !webBaseUrl) {
  console.error("API_BASE_URL and WEB_BASE_URL are required.");
  process.exit(1);
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function assertOk(label, url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}) at ${url}`);
  }
  const body = await response.text();
  console.log(`OK: ${label} (${response.status}) ${url}`);
  return body;
}

async function assertBlocklistManifest(apiBase) {
  const manifestUrl = `${apiBase}/v1/blocklist/manifest`;
  const response = await fetch(manifestUrl);

  if (response.status === 404) {
    console.log(`SKIP: Blocklist manifest not published yet (404)`);
    return null;
  }

  if (!response.ok) {
    throw new Error(`Blocklist manifest failed (${response.status}) at ${manifestUrl}`);
  }

  const manifest = await response.json();
  console.log(`OK: Blocklist manifest (${response.status}) ${manifestUrl}`);

  if (!manifest.version || manifest.version === "none") {
    throw new Error(`Blocklist manifest has invalid version: ${manifest.version}`);
  }
  console.log(`  - version: ${manifest.version}`);

  if (!manifest.signature || manifest.signature.length === 0) {
    throw new Error(`Blocklist manifest missing signature`);
  }
  console.log(`  - signature: ${manifest.signature.slice(0, 32)}...`);

  if (!manifest.artifactUrls?.delta || typeof manifest.artifactUrls.delta !== "string") {
    throw new Error(`Blocklist manifest missing artifactUrls.delta`);
  }
  console.log(`  - delta URL: ${manifest.artifactUrls.delta}`);

  return manifest;
}

async function assertDeltaArtifact(manifest) {
  if (!manifest) return;

  const deltaUrl = manifest.artifactUrls.delta;
  const response = await fetch(deltaUrl);

  if (!response.ok) {
    throw new Error(`Delta artifact fetch failed (${response.status}) at ${deltaUrl}`);
  }

  const delta = await response.json();
  console.log(`OK: Delta artifact (${response.status}) ${deltaUrl}`);

  if (!Array.isArray(delta.domains)) {
    throw new Error(`Delta artifact missing domains array`);
  }
  console.log(`  - domains count: ${delta.domains.length}`);

  if (!delta.signature || delta.signature.length === 0) {
    throw new Error(`Delta artifact missing signature`);
  }
  console.log(`  - signature: ${delta.signature.slice(0, 32)}...`);

  const canonicalBytes = new TextEncoder().encode(JSON.stringify({ domains: delta.domains }));
  const actualSha256 = sha256Hex(canonicalBytes);

  if (actualSha256 !== manifest.sha256) {
    throw new Error(`Delta SHA256 mismatch: expected ${manifest.sha256}, got ${actualSha256}`);
  }
  console.log(`  - SHA256 verified: ${actualSha256}`);
}

async function main() {
  const apiBase = apiBaseUrl.replace(/\/$/, "");
  const webBase = webBaseUrl.replace(/\/$/, "");

  await assertOk("API health", `${apiBase}/health`);
  await assertOk("API status", `${apiBase}/v1/status`);
  await assertOk("Web home", `${webBase}/`);
  await assertOk("Web pricing", `${webBase}/pricing`);

  if (!skipBlocklist) {
    const manifest = await assertBlocklistManifest(apiBase);
    await assertDeltaArtifact(manifest);
  } else {
    console.log("SKIP: Blocklist checks (SKIP_BLOCKLIST_CHECK=true)");
  }

  console.log("\nAll health checks passed!");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
