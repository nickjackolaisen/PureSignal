import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const projectRoot = path.resolve(process.cwd(), "..");
const localCache = path.join(process.cwd(), ".cache");
const mergedHostsPath = path.join(localCache, "merged-hosts.txt");
const hostsBackupPath = path.join(localCache, "hosts.backup");

function systemHostsPath() {
  if (process.platform === "win32") {
    return "C:\\Windows\\System32\\drivers\\etc\\hosts";
  }
  return "/etc/hosts";
}

async function ensureCache() {
  await fs.mkdir(localCache, { recursive: true });
}

async function mergeSourceHosts() {
  await ensureCache();
  const sources = ["hosts00", "hosts01", "hosts02", "hosts03", "hosts04", "hosts05"];
  const chunks = await Promise.all(
    sources.map(async (filename) => fs.readFile(path.join(projectRoot, filename), "utf8"))
  );
  const merged = chunks.join("\n");
  await fs.writeFile(mergedHostsPath, merged, "utf8");
  return mergedHostsPath;
}

export async function applyHostsBlocklist() {
  await ensureCache();
  const hostsPath = systemHostsPath();
  const sourcePath = await mergeSourceHosts();
  const existing = await fs.readFile(hostsPath, "utf8");
  await fs.writeFile(hostsBackupPath, existing, "utf8");

  const blockEntries = await fs.readFile(sourcePath, "utf8");
  const markerStart = "# puresignal:start";
  const markerEnd = "# puresignal:end";
  const stripped = existing.replace(new RegExp(`${markerStart}[\\s\\S]*${markerEnd}\\n?`, "g"), "");
  const next =
    `${stripped.trim()}\n\n${markerStart}\n` +
    `# generated on ${new Date().toISOString()} by ${os.hostname()}\n` +
    `${blockEntries}\n${markerEnd}\n`;
  await fs.writeFile(hostsPath, next, "utf8");
}

export async function restoreHostsBackup() {
  const hostsPath = systemHostsPath();
  const backup = await fs.readFile(hostsBackupPath, "utf8");
  await fs.writeFile(hostsPath, backup, "utf8");
}

export async function hostsEntryCount() {
  const content = await fs.readFile(mergedHostsPath, "utf8").catch(() => "");
  return content.split("\n").filter((line) => line.trim() && !line.startsWith("#")).length;
}
