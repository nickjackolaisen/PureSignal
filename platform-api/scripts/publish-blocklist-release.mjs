#!/usr/bin/env node
/**
 * Blocklist Release Publisher
 *
 * Reads hosts files, signs a delta payload with ECDSA P-256, uploads to Cloudflare R2,
 * and upserts a BlocklistRelease row in the database.
 *
 * Usage:
 *   node scripts/publish-blocklist-release.mjs --version 2026.05.01 [--changelog "..."] [--max-delta 8000] [--dry-run]
 *
 * Required environment variables:
 *   DATABASE_URL              - Postgres connection string
 *   BLOCKLIST_SIGNING_KEY     - Private JWK for ECDSA P-256 signing (JSON string)
 *   R2_ACCOUNT_ID             - Cloudflare account ID
 *   R2_ACCESS_KEY_ID          - R2 API token access key
 *   R2_SECRET_ACCESS_KEY      - R2 API token secret key
 *   R2_BUCKET                 - R2 bucket name (e.g. puresignal-blocklist)
 *   R2_PUBLIC_BASE_URL        - Public URL prefix (e.g. https://blocklist.puresignal.io)
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const hostsFiles = ["hosts00", "hosts01", "hosts02", "hosts03", "hosts04", "hosts05"].map((name) =>
  path.join(repoRoot, name)
);
const whitelistPath = path.join(repoRoot, "whitelist");
const extensionRulesDir = path.join(repoRoot, "extension", "rules");

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
  const skipSet = new Set();
  if (!fs.existsSync(whitelistPath)) {
    return skipSet;
  }

  const file = readline.createInterface({
    input: fs.createReadStream(whitelistPath),
    crlfDelay: Infinity
  });

  for await (const line of file) {
    const domain = normalizeDomain(line);
    if (domain) {
      skipSet.add(domain);
    }
  }
  return skipSet;
}

async function collectAllDomains(maxDomains = Infinity) {
  const skipSet = await loadWhitelist();
  const domains = new Set();

  for (const filePath of hostsFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const lines = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of lines) {
      if (domains.size >= maxDomains) break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(/\s+/);
      const candidate = normalizeDomain(parts[1] || "");
      if (!candidate || skipSet.has(candidate)) continue;
      domains.add(candidate);
    }
    if (domains.size >= maxDomains) break;
  }

  return domains;
}

function loadBakedDomains() {
  const bakedDomains = new Set();
  if (!fs.existsSync(extensionRulesDir)) {
    return bakedDomains;
  }

  const ruleFiles = fs.readdirSync(extensionRulesDir).filter((f) => f.startsWith("blocklist_core_") && f.endsWith(".json"));

  for (const ruleFile of ruleFiles) {
    try {
      const rules = JSON.parse(fs.readFileSync(path.join(extensionRulesDir, ruleFile), "utf8"));
      for (const rule of rules) {
        const urlFilter = rule.condition?.urlFilter || "";
        const match = urlFilter.match(/^\|\|(.+)\^$/);
        if (match) {
          bakedDomains.add(match[1]);
        }
      }
    } catch {
      console.warn(`Warning: Could not parse ${ruleFile}`);
    }
  }

  return bakedDomains;
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function signPayload(payloadBytes, privateKeyJwk) {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    payloadBytes
  );
  return Buffer.from(signature).toString("base64");
}

function createS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

async function uploadToR2(s3Client, bucket, key, body, contentType = "application/json") {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      version: { type: "string", short: "v" },
      changelog: { type: "string", short: "c", default: "" },
      "max-delta": { type: "string", default: "8000" },
      "dry-run": { type: "boolean", default: false }
    }
  });

  const version = args.version;
  const changelog = args.changelog || `Blocklist release ${version}`;
  const maxDelta = parseInt(args["max-delta"], 10);
  const dryRun = args["dry-run"];

  if (!version) {
    console.error("Usage: node publish-blocklist-release.mjs --version <calver> [--changelog <text>] [--max-delta <n>] [--dry-run]");
    process.exit(1);
  }

  console.log(`Publishing blocklist release: ${version}`);
  console.log(`  Changelog: ${changelog}`);
  console.log(`  Max delta domains: ${maxDelta}`);
  console.log(`  Dry run: ${dryRun}`);

  const signingKeyJson = process.env.BLOCKLIST_SIGNING_KEY;
  if (!signingKeyJson) {
    throw new Error("BLOCKLIST_SIGNING_KEY environment variable is required");
  }
  const privateKeyJwk = JSON.parse(signingKeyJson);

  console.log("\n[1/6] Loading all domains from hosts files...");
  const allDomains = await collectAllDomains();
  console.log(`  Total domains in hosts files: ${allDomains.size}`);

  console.log("\n[2/6] Loading already-baked domains from extension rules...");
  const bakedDomains = loadBakedDomains();
  console.log(`  Already baked in extension: ${bakedDomains.size}`);

  console.log("\n[3/6] Computing delta (domains not in extension)...");
  const deltaDomains = [...allDomains].filter((d) => !bakedDomains.has(d)).slice(0, maxDelta);
  console.log(`  Delta domains: ${deltaDomains.length}`);

  console.log("\n[4/6] Signing delta payload...");
  const deltaCanonical = JSON.stringify({ domains: deltaDomains });
  const deltaBytes = new TextEncoder().encode(deltaCanonical);
  const deltaSha256 = sha256Hex(deltaBytes);
  const deltaSignature = await signPayload(deltaBytes, privateKeyJwk);
  console.log(`  Delta SHA256: ${deltaSha256}`);
  console.log(`  Delta signature: ${deltaSignature.slice(0, 32)}...`);

  const deltaPayload = { domains: deltaDomains, signature: deltaSignature };
  const deltaKey = `deltas/v1/delta-${version}.json`;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || "https://blocklist.puresignal.io";
  const deltaPublicUrl = `${publicBaseUrl}/${deltaKey}`;

  console.log("\n[5/6] Signing manifest payload...");
  const manifestPayload = {
    version,
    artifactUrls: { delta: deltaPublicUrl },
    sha256: deltaSha256,
    minClientVersion: "1.0.0"
  };
  const manifestCanonical = JSON.stringify(manifestPayload);
  const manifestBytes = new TextEncoder().encode(manifestCanonical);
  const manifestSignature = await signPayload(manifestBytes, privateKeyJwk);
  console.log(`  Manifest signature: ${manifestSignature.slice(0, 32)}...`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would upload to R2:");
    console.log(`  Key: ${deltaKey}`);
    console.log(`  Public URL: ${deltaPublicUrl}`);
    console.log("\n[DRY RUN] Would create BlocklistRelease row:");
    console.log(JSON.stringify({ ...manifestPayload, signature: manifestSignature, changelog }, null, 2));
    console.log("\nDry run complete. No changes made.");
    return;
  }

  if (!bucket) {
    throw new Error("R2_BUCKET environment variable is required");
  }

  console.log("\n[6/6] Uploading to R2 and writing database row...");
  const s3Client = createS3Client();
  await uploadToR2(s3Client, bucket, deltaKey, JSON.stringify(deltaPayload));
  console.log(`  Uploaded: ${deltaPublicUrl}`);

  const prisma = new PrismaClient();
  try {
    await prisma.blocklistRelease.upsert({
      where: { version },
      create: {
        version,
        changelog,
        artifactUrls: manifestPayload.artifactUrls,
        sha256: deltaSha256,
        signature: manifestSignature,
        minClientVersion: manifestPayload.minClientVersion,
        publishedAt: new Date()
      },
      update: {
        changelog,
        artifactUrls: manifestPayload.artifactUrls,
        sha256: deltaSha256,
        signature: manifestSignature,
        minClientVersion: manifestPayload.minClientVersion,
        publishedAt: new Date()
      }
    });
    console.log(`  Created/updated BlocklistRelease: ${version}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\nRelease published successfully!");
  console.log(`  Version: ${version}`);
  console.log(`  Delta URL: ${deltaPublicUrl}`);
  console.log(`  Delta domains: ${deltaDomains.length}`);
}

main().catch((error) => {
  console.error("Release failed:", error.message);
  process.exit(1);
});
