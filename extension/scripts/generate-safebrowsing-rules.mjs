import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const extensionDir = path.join(repoRoot, "extension");
const rulesPath = path.join(extensionDir, "rules", "safebrowsing_redirects.json");
const safebrowsingPath = path.join(repoRoot, "safebrowsing");

const redirectTargets = [
  {
    match: /^google\./,
    redirectUrl: "https://www.google.com/safe-search?utm_source=puresignal"
  },
  {
    match: /^www\.google\./,
    redirectUrl: "https://www.google.com/safe-search?utm_source=puresignal"
  },
  {
    match: /^youtube\.com$/,
    redirectUrl: "https://www.youtube.com/?persist_gl=1&safe=active"
  },
  {
    match: /^www\.youtube\.com$/,
    redirectUrl: "https://www.youtube.com/?persist_gl=1&safe=active"
  },
  {
    match: /^bing\.com$/,
    redirectUrl: "https://www.bing.com/safesearch?setlang=en-us&adlt=strict"
  },
  {
    match: /^duckduckgo\.com$/,
    redirectUrl: "https://duckduckgo.com/?kp=1"
  },
  {
    match: /^www\.duckduckgo\.com$/,
    redirectUrl: "https://duckduckgo.com/?kp=1"
  }
];

function redirectForDomain(domain) {
  const entry = redirectTargets.find((rule) => rule.match.test(domain));
  return entry?.redirectUrl || "";
}

async function main() {
  const seen = new Set();
  const rules = [];
  let id = 900_000;
  const reader = readline.createInterface({
    input: fs.createReadStream(safebrowsingPath),
    crlfDelay: Infinity
  });

  for await (const line of reader) {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const domain = (parts[1] || "").replace(/\.$/, "");
    if (!domain || seen.has(domain)) {
      continue;
    }
    const redirectUrl = redirectForDomain(domain);
    if (!redirectUrl) {
      continue;
    }
    seen.add(domain);
    id += 1;
    rules.push({
      id,
      priority: 2,
      action: { type: "redirect", redirect: { url: redirectUrl } },
      condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"] }
    });
  }

  fs.writeFileSync(rulesPath, `${JSON.stringify(rules, null, 2)}\n`);
  console.log(`Generated ${rules.length} safe browsing redirect rules.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
