import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const extensionDir = path.join(repoRoot, "extension");
const rulesDir = path.join(extensionDir, "rules");
const manifestPath = path.join(extensionDir, "manifest.json");
const hostsFiles = ["hosts00", "hosts01", "hosts02", "hosts03", "hosts04", "hosts05"].map((name) =>
  path.join(repoRoot, name)
);
const upstreamWhitelistPath = path.join(repoRoot, "whitelist");
const priorityDomainsPath = path.join(extensionDir, "data", "priority-domains.txt");

const maxRules = Number(process.env.CG_MAX_RULES || 100000);
const chunkSize = Number(process.env.CG_CHUNK_SIZE || 30000);
const staticRulesetSoftLimit = Number(process.env.CG_MAX_STATIC_RULESETS || 50);
const resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest", "image", "media"];

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase();
  if (!domain || domain.includes(" ") || domain.startsWith("#")) {
    return "";
  }
  if (domain === "localhost") {
    return "";
  }
  if (!domain.includes(".")) {
    return "";
  }
  return domain.replace(/\.$/, "");
}

async function loadWhitelist() {
  const blocked = new Set();
  if (!fs.existsSync(upstreamWhitelistPath)) {
    return blocked;
  }

  const file = readline.createInterface({
    input: fs.createReadStream(upstreamWhitelistPath),
    crlfDelay: Infinity
  });

  for await (const line of file) {
    const domain = normalizeDomain(line);
    if (domain) {
      blocked.add(domain);
    }
  }
  return blocked;
}

async function loadPriorityDomains(skipSet) {
  const domains = [];
  if (!fs.existsSync(priorityDomainsPath)) {
    return domains;
  }
  const lines = fs.readFileSync(priorityDomainsPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const domain = normalizeDomain(line);
    if (!domain || skipSet.has(domain)) {
      continue;
    }
    if (!domains.includes(domain)) {
      domains.push(domain);
    }
  }
  return domains;
}

async function collectDomains() {
  const skipSet = await loadWhitelist();
  const domains = new Set();

  for (const priorityDomain of await loadPriorityDomains(skipSet)) {
    if (domains.size >= maxRules) {
      break;
    }
    domains.add(priorityDomain);
  }

  for (const filePath of hostsFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const lines = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of lines) {
      if (domains.size >= maxRules) {
        break;
      }
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const parts = trimmed.split(/\s+/);
      const candidate = normalizeDomain(parts[1] || "");
      if (!candidate || skipSet.has(candidate)) {
        continue;
      }
      domains.add(candidate);
    }
    if (domains.size >= maxRules) {
      break;
    }
  }

  return [...domains];
}

function writeChunks(domains) {
  const rulesetIds = [];
  let globalIndex = 0;
  for (let start = 0; start < domains.length; start += chunkSize) {
    const chunk = domains.slice(start, start + chunkSize);
    const rulesetNumber = String(Math.floor(start / chunkSize) + 1).padStart(2, "0");
    const rulesetId = `blocklist_core_${rulesetNumber}`;
    rulesetIds.push(rulesetId);
    const outPath = path.join(rulesDir, `${rulesetId}.json`);
    const rules = chunk.map((domain) => {
      globalIndex += 1;
      return {
        id: globalIndex,
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
        condition: { urlFilter: `||${domain}^`, resourceTypes }
      };
    });
    fs.writeFileSync(outPath, JSON.stringify(rules));
  }
  return rulesetIds;
}

function updateManifestRulesets(rulesetIds) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const existing = manifest.declarative_net_request?.rule_resources || [];
  const preserved = existing.filter((item) => !item.id.startsWith("blocklist_core_"));
  const generated = rulesetIds.map((id) => ({
    id,
    enabled: true,
    path: `rules/${id}.json`
  }));

  manifest.declarative_net_request.rule_resources = [...generated, ...preserved];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  fs.mkdirSync(rulesDir, { recursive: true });
  const domains = await collectDomains();
  const rulesetIds = writeChunks(domains);
  if (rulesetIds.length > staticRulesetSoftLimit) {
    throw new Error(
      `Generated ${rulesetIds.length} rulesets, above configured soft limit ${staticRulesetSoftLimit}.`
    );
  }
  updateManifestRulesets(rulesetIds);
  console.log(
    `Generated ${domains.length} domains across ${rulesetIds.length} rulesets: ${rulesetIds.join(", ")}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
