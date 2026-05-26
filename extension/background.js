const KEYWORD_RULE_BASE_ID = 1_000_000;
const WHITELIST_RULE_BASE_ID = 1_100_000;
const WHITELIST_RULE_MAX = 4_000;
const STATS_KEY = "stats";
const SETTINGS_KEY = "settings";
const WHITELIST_KEY = "whitelistEntries";
/** All core chunk rulesets + safe-search redirects from manifest (not just blocklist_core_01). */
function buildDefaultRulesetIds() {
  const resources = chrome.runtime.getManifest().declarative_net_request?.rule_resources || [];
  const core = resources.filter((r) => r.id.startsWith("blocklist_core_")).map((r) => r.id);
  const safe = resources.some((r) => r.id === "safebrowsing_redirects") ? ["safebrowsing_redirects"] : [];
  return [...core, ...safe];
}

const DEFAULT_RULESET_IDS = buildDefaultRulesetIds();
const DEFAULT_API_BASE_URL = "https://api.puresignal.io";
const UPDATE_ALARM = "updateBlocklistDelta";
const WHITELIST_ALARM = "syncWhitelist";
const DISABLE_COOLDOWN_ALARM = "disableProtectionCooldown";

/**
 * Default public JWK for blocklist manifest signature verification.
 * This is the ECDSA P-256 public key that matches the private key used to sign releases.
 * Replace this with your actual public key JWK after generating the key pair.
 */
const DEFAULT_MANIFEST_PUBLIC_KEY_JWK = {"kty":"EC","x":"iN00rK-pGF5l58HfdEZs8NcIRMTlF0aVWYuyAUvq-o0","y":"Wm5wRUitr_XREF4NMKo6EH_aAfMBEBfEv3SxW2DHMjc","crv":"P-256"};

const DEFAULT_SETTINGS = {
  settingsVersion: 4,
  planCode: "free",
  featureFlags: {
    partnerRelay: false,
    advancedAnalytics: false,
    signedUpdates: false,
    cloudSync: false,
    desktopAdvanced: false,
    prioritySupport: false
  },
  enabledRulesets: DEFAULT_RULESET_IDS,
  keywordBlockingEnabled: false,
  protectionEnabled: true,
  keywordList: ["porn", "xxx", "hentai", "onlyfans", "adult"],
  remoteDeltaUrl: "",
  signedManifestUrl: "",
  manifestPublicKeyJwk: DEFAULT_MANIFEST_PUBLIC_KEY_JWK,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  apiUserId: "",
  apiDeviceId: "",
  apiToken: "",
  partnerLabel: "",
  partnerConsent: false,
  stealthMode: false,
  protectionDisableReason: "",
  protectionDisableRequestedAt: 0,
  protectionDisableUnlockAt: 0
};

const DEFAULT_STATS = {
  blockedAttempts: 0,
  streakDays: 0,
  lastBlockDate: null,
  lastBlockedUrl: "",
  urgeLog: []
};

function toIsoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
}

async function setSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

async function migrateSettingsIfNeeded() {
  const settings = await getSettings();
  const version = settings.settingsVersion || 1;

  if (version < 2) {
    await setSettings({
      settingsVersion: 2,
      planCode: settings.planCode || "free",
      featureFlags: settings.featureFlags || DEFAULT_SETTINGS.featureFlags
    });
  }

  if (version < 3) {
    await setSettings({
      settingsVersion: 3,
      manifestPublicKeyJwk: settings.manifestPublicKeyJwk || DEFAULT_MANIFEST_PUBLIC_KEY_JWK
    });
  }

  if (version < 4) {
    const current = await getSettings();
    const manifestCore = buildDefaultRulesetIds().filter(
      (id) => id.startsWith("blocklist_core_") || id === "safebrowsing_redirects"
    );
    const enabled = new Set(current.enabledRulesets || []);
    manifestCore.forEach((id) => enabled.add(id));
    await setSettings({
      settingsVersion: 4,
      enabledRulesets: [...enabled],
      apiBaseUrl: current.apiBaseUrl || DEFAULT_API_BASE_URL
    });
  }
}

async function bootstrapManifestConfig() {
  const settings = await getSettings();
  if (!settings.apiBaseUrl) {
    return;
  }

  const updates = {};

  if (!settings.signedManifestUrl) {
    updates.signedManifestUrl = `${settings.apiBaseUrl}/v1/blocklist/manifest`;
  }

  if (!settings.manifestPublicKeyJwk || settings.manifestPublicKeyJwk === DEFAULT_MANIFEST_PUBLIC_KEY_JWK) {
    try {
      const response = await fetch(`${settings.apiBaseUrl}/v1/blocklist/public-key`);
      if (response.ok) {
        const data = await response.json();
        if (data.jwk) {
          updates.manifestPublicKeyJwk = JSON.stringify(data.jwk);
        }
      }
    } catch {
      // ignore fetch failures, use hardcoded default
    }
  }

  if (Object.keys(updates).length > 0) {
    await setSettings(updates);
  }
}

async function getStats() {
  const stored = await chrome.storage.local.get(STATS_KEY);
  return { ...DEFAULT_STATS, ...(stored[STATS_KEY] || {}) };
}

async function setStats(partial) {
  const current = await getStats();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [STATS_KEY]: next });
  return next;
}

async function applyEnabledRulesets() {
  const settings = await getSettings();
  if (!settings.protectionEnabled) {
    const allRulesets = (await chrome.runtime.getManifest()).declarative_net_request?.rule_resources || [];
    const disableRulesetIds = allRulesets.map((rule) => rule.id);
    if (disableRulesetIds.length) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds
      });
    }
    return;
  }
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: settings.enabledRulesets
  });
}

async function clearDynamicRulesInRange(startId, endId) {
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = dynamicRules
    .filter((rule) => rule.id >= startId && rule.id <= endId)
    .map((rule) => rule.id);

  if (removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
}

async function syncKeywordRules() {
  const settings = await getSettings();
  await clearDynamicRulesInRange(KEYWORD_RULE_BASE_ID, KEYWORD_RULE_BASE_ID + 50_000);

  if (!settings.keywordBlockingEnabled) {
    return;
  }

  const cleanKeywords = settings.keywordList
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!cleanKeywords.length) {
    return;
  }

  const addRules = cleanKeywords.map((keyword, index) => ({
    id: KEYWORD_RULE_BASE_ID + index,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: keyword,
      resourceTypes: ["main_frame"]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules
  });
}

function toAllowRule(entry, index) {
  return {
    id: WHITELIST_RULE_BASE_ID + index,
    priority: 10,
    action: { type: "allow" },
    condition: {
      urlFilter: `||${entry.domain}^`,
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "image", "media"]
    }
  };
}

async function syncWhitelistRules() {
  await clearDynamicRulesInRange(WHITELIST_RULE_BASE_ID, WHITELIST_RULE_BASE_ID + WHITELIST_RULE_MAX);

  const stored = await chrome.storage.local.get(WHITELIST_KEY);
  const now = Date.now();
  const entries = (stored[WHITELIST_KEY] || []).filter((item) => item.expiresAt > now);

  if (entries.length !== (stored[WHITELIST_KEY] || []).length) {
    await chrome.storage.local.set({ [WHITELIST_KEY]: entries });
  }

  if (!entries.length) {
    return;
  }

  const addRules = entries.slice(0, WHITELIST_RULE_MAX).map(toAllowRule);
  await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
}

async function updateBlockStats(triggerUrl = "") {
  const stats = await getStats();
  const now = Date.now();
  const today = toIsoDate(now);
  const last = stats.lastBlockDate;
  let streakDays = Number(stats.streakDays || 0);

  if (!last) {
    streakDays = 1;
  } else if (last === today) {
    streakDays = Math.max(1, streakDays);
  } else {
    const dayDiff = Math.floor((new Date(today) - new Date(last)) / 86_400_000);
    streakDays = dayDiff === 1 ? streakDays + 1 : 1;
  }

  await setStats({
    blockedAttempts: Number(stats.blockedAttempts || 0) + 1,
    streakDays,
    lastBlockDate: today,
    lastBlockedUrl: triggerUrl
  });
}

async function notifyPartner(reason, extra = {}) {
  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.partnerConsent || !settings.apiUserId || !settings.apiDeviceId) {
    return;
  }

  try {
    await fetch(`${settings.apiBaseUrl}/v1/alerts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiToken}`
      },
      body: JSON.stringify({
        userId: settings.apiUserId,
        deviceId: settings.apiDeviceId,
        reason,
        type: reason,
        payload: {
          at: new Date().toISOString(),
          partnerLabel: settings.partnerLabel || "",
          ...extra
        }
      })
    });
  } catch (error) {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "PureSignal Partner Alert Failed",
      message: "Could not reach partner webhook."
    });
  }
}

async function captureVisibleScreenshot() {
  try {
    return await chrome.tabs.captureVisibleTab(undefined, { format: "jpeg", quality: 50 });
  } catch (_error) {
    return "";
  }
}

async function requestDisableProtection(reason) {
  const now = Date.now();
  const unlockAt = now + 30 * 60 * 1000;
  const nextSettings = await setSettings({
    protectionDisableReason: reason,
    protectionDisableRequestedAt: now,
    protectionDisableUnlockAt: unlockAt
  });
  chrome.alarms.create(DISABLE_COOLDOWN_ALARM, { periodInMinutes: 1 });
  const screenshotDataUrl = await captureVisibleScreenshot();
  await notifyPartner("PROTECTION_DISABLE_REQUESTED", {
    reason,
    unlockAt: new Date(unlockAt).toISOString(),
    screenshotDataUrl
  });
  return nextSettings;
}

async function checkDisableCooldown() {
  const settings = await getSettings();
  if (!settings.protectionDisableUnlockAt) {
    return;
  }
  const now = Date.now();
  if (now < settings.protectionDisableUnlockAt) {
    return;
  }
  await setSettings({
    protectionEnabled: false,
    protectionDisableUnlockAt: 0
  });
  await refreshAllRules();
  await notifyPartner("PROTECTION_DISABLED_AFTER_COOLDOWN", {
    requestedAt: settings.protectionDisableRequestedAt,
    reason: settings.protectionDisableReason || ""
  });
}

async function refreshAllRules() {
  await applyEnabledRulesets();
  await syncKeywordRules();
  await syncWhitelistRules();
}

async function syncEntitlements() {
  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.apiUserId) {
    return;
  }
  try {
    const response = await fetch(`${settings.apiBaseUrl}/v1/entitlements?userId=${settings.apiUserId}`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const flags = data.flags || DEFAULT_SETTINGS.featureFlags;
    await setSettings({
      planCode: data.planCode || "free",
      featureFlags: flags,
      partnerConsent: Boolean(flags.partnerRelay && settings.partnerConsent)
    });
  } catch (_error) {
    // ignore transient entitlement fetch failures
  }
}

function hasValidManifestSignature(payload) {
  return Boolean(
    payload?.signature &&
      payload?.artifactUrls?.delta &&
      typeof payload?.version === "string" &&
      typeof payload?.sha256 === "string"
  );
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

async function verifySignedPayload(payload, signatureB64, publicKeyJwk) {
  if (!publicKeyJwk || !signatureB64) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(publicKeyJwk),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  const signature = base64ToUint8Array(signatureB64);
  const data = new TextEncoder().encode(JSON.stringify(payload));
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, data);
}

async function applyDeltaDomains(domains) {
  const addRules = domains.slice(0, 500).map((domain, index) => ({
    id: KEYWORD_RULE_BASE_ID + 50_000 + index,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"] }
  }));
  await clearDynamicRulesInRange(KEYWORD_RULE_BASE_ID + 50_000, KEYWORD_RULE_BASE_ID + 60_000);
  if (addRules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  }
  await chrome.storage.local.set({
    lastSyncAt: Date.now(),
    lastSyncDomainCount: addRules.length,
    lastGoodDeltaDomains: domains
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const reason = details.reason;

  if (reason === "install") {
    // First install: seed defaults only if storage is empty
    const stored = await chrome.storage.local.get([SETTINGS_KEY, STATS_KEY]);
    if (!stored[SETTINGS_KEY]) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    }
    if (!stored[STATS_KEY]) {
      await chrome.storage.local.set({ [STATS_KEY]: DEFAULT_STATS });
    }
    // Open onboarding only on first install
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  } else if (reason === "update") {
    // Extension update: migrate settings, preserve user data
    await migrateSettingsIfNeeded();
  }

  // Common to both install and update
  await refreshAllRules();
  await bootstrapManifestConfig();
  await syncEntitlements();

  // Create alarms idempotently (clear first to avoid duplicates)
  await chrome.alarms.clear(UPDATE_ALARM);
  await chrome.alarms.clear(WHITELIST_ALARM);
  await chrome.alarms.clear(DISABLE_COOLDOWN_ALARM);
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 24 * 60 });
  chrome.alarms.create(WHITELIST_ALARM, { periodInMinutes: 15 });
  chrome.alarms.create(DISABLE_COOLDOWN_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await migrateSettingsIfNeeded();
  await refreshAllRules();
  await bootstrapManifestConfig();
  await syncEntitlements();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === UPDATE_ALARM) {
    const settings = await getSettings();
    if (!settings.remoteDeltaUrl && !settings.signedManifestUrl) {
      return;
    }

    try {
      let domains = [];
      if (settings.signedManifestUrl) {
        const manifestRes = await fetch(settings.signedManifestUrl);
        if (!manifestRes.ok) {
          throw new Error(`Manifest fetch failed with ${manifestRes.status}`);
        }
        const manifestPayload = await manifestRes.json();
        if (!hasValidManifestSignature(manifestPayload)) {
          throw new Error("Manifest signature mismatch");
        }
        const validManifest = await verifySignedPayload(
          {
            version: manifestPayload.version,
            artifactUrls: manifestPayload.artifactUrls,
            sha256: manifestPayload.sha256,
            minClientVersion: manifestPayload.minClientVersion
          },
          manifestPayload.signature,
          settings.manifestPublicKeyJwk
        );
        if (!validManifest) {
          throw new Error("Manifest signature verification failed");
        }
        const deltaRes = await fetch(String(manifestPayload.artifactUrls?.delta || ""));
        if (!deltaRes.ok) {
          throw new Error(`Delta fetch failed with ${deltaRes.status}`);
        }
        const deltaPayload = await deltaRes.json();
        const validDelta = await verifySignedPayload(
          { domains: deltaPayload.domains || [] },
          deltaPayload.signature,
          settings.manifestPublicKeyJwk
        );
        if (!validDelta) {
          throw new Error("Delta signature verification failed");
        }
        domains = Array.isArray(deltaPayload.domains) ? deltaPayload.domains : [];
      } else {
        const response = await fetch(settings.remoteDeltaUrl);
        if (!response.ok) {
          throw new Error(`Remote fetch failed with ${response.status}`);
        }
        const payload = await response.json();
        domains = Array.isArray(payload.domains) ? payload.domains : [];
      }
      await applyDeltaDomains(domains);
    } catch (_error) {
      const stored = await chrome.storage.local.get("lastGoodDeltaDomains");
      if (Array.isArray(stored.lastGoodDeltaDomains) && stored.lastGoodDeltaDomains.length) {
        await applyDeltaDomains(stored.lastGoodDeltaDomains);
      }
    }
  }

  if (alarm.name === WHITELIST_ALARM) {
    await syncWhitelistRules();
  }

  if (alarm.name === DISABLE_COOLDOWN_ALARM) {
    await checkDisableCooldown();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GET_STATE") {
      const settings = await getSettings();
      const stats = await getStats();
      const stored = await chrome.storage.local.get(WHITELIST_KEY);
      sendResponse({ settings, stats, whitelistEntries: stored[WHITELIST_KEY] || [] });
      return;
    }

    if (message?.type === "SAVE_SETTINGS") {
      await setSettings(message.payload || {});
      await refreshAllRules();
      await syncEntitlements();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "ADD_WHITELIST") {
      const stored = await chrome.storage.local.get(WHITELIST_KEY);
      const current = stored[WHITELIST_KEY] || [];
      const domain = String(message.payload?.domain || "").trim().toLowerCase();
      const reason = String(message.payload?.reason || "").trim();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const next = current
        .filter((item) => item.domain !== domain)
        .concat([{ domain, reason, createdAt: Date.now(), expiresAt }]);
      await chrome.storage.local.set({ [WHITELIST_KEY]: next });
      await syncWhitelistRules();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "LOG_URGE") {
      const stats = await getStats();
      const urgeLog = [message.payload, ...(stats.urgeLog || [])].slice(0, 200);
      await setStats({ urgeLog });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "BLOCKED_ATTEMPT") {
      const url = String(message.payload?.url || "");
      await updateBlockStats(url);
      await notifyPartner("BLOCKED_ATTEMPT", { url });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "PARTNER_TEST") {
      const settings = await getSettings();
      if (!settings.featureFlags?.partnerRelay) {
        sendResponse({ ok: false, error: "Partner relay is a Pro feature." });
        return;
      }
      await notifyPartner("PARTNER_TEST");
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "REPORT_FALSE_POSITIVE") {
      const settings = await getSettings();
      if (!settings.apiBaseUrl) {
        sendResponse({ ok: false, error: "API base URL not configured." });
        return;
      }
      const domain = String(message.payload?.domain || "").trim().toLowerCase();
      const reason = String(message.payload?.reason || "").trim();
      const email = String(message.payload?.email || "").trim().toLowerCase();
      const response = await fetch(`${settings.apiBaseUrl}/v1/support/report-site`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${settings.apiToken}`
        },
        body: JSON.stringify({ email, domain, reason })
      });
      sendResponse({ ok: response.ok });
      return;
    }

    if (message?.type === "REQUEST_DISABLE_PROTECTION") {
      const reason = String(message.payload?.reason || "").trim() || "No reason provided";
      const settings = await requestDisableProtection(reason);
      sendResponse({
        ok: true,
        unlockAt: settings.protectionDisableUnlockAt
      });
      return;
    }

    if (message?.type === "CANCEL_DISABLE_PROTECTION") {
      await setSettings({
        protectionDisableReason: "",
        protectionDisableRequestedAt: 0,
        protectionDisableUnlockAt: 0
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "BOOTSTRAP_MANIFEST") {
      // Manual bootstrap trigger (for testing): chrome.runtime.sendMessage({ type: "BOOTSTRAP_MANIFEST" })
      try {
        await bootstrapManifestConfig();
        const settings = await getSettings();
        sendResponse({
          success: true,
          signedManifestUrl: settings.signedManifestUrl || "",
          hasManifestPublicKeyJwk: Boolean(settings.manifestPublicKeyJwk)
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(async (event) => {
  if (event.request?.url) {
    await updateBlockStats(event.request.url);
  }
});
