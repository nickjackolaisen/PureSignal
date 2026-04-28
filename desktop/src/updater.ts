import fs from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";

const cacheDir = path.join(process.cwd(), ".cache");
const manifestPath = path.join(cacheDir, "manifest.json");

export async function syncManifest() {
  await fs.mkdir(cacheDir, { recursive: true });
  const manifestUrl = process.env.CG_SIGNED_MANIFEST_URL;
  if (!manifestUrl) {
    return;
  }
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest: ${res.status}`);
  }
  const manifest = await res.json();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

export async function readManifest() {
  const data = await fs.readFile(manifestPath, "utf8").catch(() => "{}");
  return JSON.parse(data);
}
