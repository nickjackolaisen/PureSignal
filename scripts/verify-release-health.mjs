#!/usr/bin/env node

const apiBaseUrl = process.env.API_BASE_URL;
const webBaseUrl = process.env.WEB_BASE_URL;

if (!apiBaseUrl || !webBaseUrl) {
  console.error("API_BASE_URL and WEB_BASE_URL are required.");
  process.exit(1);
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

async function main() {
  await assertOk("API health", `${apiBaseUrl.replace(/\/$/, "")}/health`);
  await assertOk("API status", `${apiBaseUrl.replace(/\/$/, "")}/v1/status`);
  await assertOk("Web home", `${webBaseUrl.replace(/\/$/, "")}/`);
  await assertOk("Web pricing", `${webBaseUrl.replace(/\/$/, "")}/pricing`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
