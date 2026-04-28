import fetch from "node-fetch";

export async function getEntitlements() {
  const apiBase = process.env.CG_API_BASE_URL || "http://localhost:8787";
  const userId = process.env.CG_USER_ID || "local_user";
  const res = await fetch(`${apiBase}/v1/entitlements?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load entitlements: ${res.status}`);
  }
  return res.json();
}

export async function registerDevice() {
  const apiBase = process.env.CG_API_BASE_URL || "http://localhost:8787";
  const userId = process.env.CG_USER_ID || "local_user";
  const payload = {
    userId,
    type: "desktop",
    name: process.env.CG_DEVICE_NAME || "Desktop Client",
    appVersion: "0.1.0",
    deviceTokenHash: process.env.CG_DEVICE_TOKEN_HASH || "replace_me_with_real_hash_token"
  };
  const res = await fetch(`${apiBase}/v1/devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Failed to register device: ${res.status}`);
  }
  return res.json();
}
