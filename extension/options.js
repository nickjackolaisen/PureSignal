const SETTINGS_PASSWORD_KEY = "settingsPassword";
const SETTINGS_KEY = "settings";

function cleanDomain(input) {
  return String(input || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function renderWhitelist(items) {
  const list = document.getElementById("whitelistItems");
  list.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    const expiry = new Date(item.expiresAt).toLocaleString();
    li.textContent = `${item.domain} - expires ${expiry}${item.reason ? ` - ${item.reason}` : ""}`;
    list.appendChild(li);
  });
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return {
    salt: Array.from(salt),
    hash: Array.from(new Uint8Array(hash)),
    iterations: 120000,
    hashName: "SHA-256"
  };
}

async function verifyPassword(password) {
  const stored = await chrome.storage.local.get(SETTINGS_PASSWORD_KEY);
  const payload = stored[SETTINGS_PASSWORD_KEY];
  if (!payload) {
    return true;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new Uint8Array(payload.salt),
      iterations: payload.iterations,
      hash: payload.hashName
    },
    keyMaterial,
    256
  );

  const candidate = Array.from(new Uint8Array(hash));
  return candidate.every((value, index) => value === payload.hash[index]);
}

async function requirePassword() {
  const stored = await chrome.storage.local.get(SETTINGS_PASSWORD_KEY);
  if (!stored[SETTINGS_PASSWORD_KEY]) {
    return true;
  }
  const input = window.prompt("Enter PureSignal settings password");
  if (!input) {
    return false;
  }
  return verifyPassword(input);
}

function getCoreRulesetIds() {
  const resources = chrome.runtime.getManifest().declarative_net_request?.rule_resources || [];
  return resources.filter((r) => r.id.startsWith("blocklist_core_")).map((r) => r.id);
}

async function init() {
  const keywordBlockingEnabled = document.getElementById("keywordBlockingEnabled");
  const planStatus = document.getElementById("planStatus");
  const rulesetCore = document.getElementById("rulesetCore");
  const rulesetSafe = document.getElementById("rulesetSafe");
  const protectionEnabled = document.getElementById("protectionEnabled");
  const disableReason = document.getElementById("disableReason");
  const requestDisable = document.getElementById("requestDisable");
  const cancelDisable = document.getElementById("cancelDisable");
  const disableStatus = document.getElementById("disableStatus");
  const keywordList = document.getElementById("keywordList");
  const wlDomain = document.getElementById("wlDomain");
  const wlReason = document.getElementById("wlReason");
  const addWhitelist = document.getElementById("addWhitelist");
  const password = document.getElementById("password");
  const savePassword = document.getElementById("savePassword");
  const passwordStatus = document.getElementById("passwordStatus");
  const partnerLabel = document.getElementById("partnerLabel");
  const apiBaseUrl = document.getElementById("apiBaseUrl");
  const apiUserId = document.getElementById("apiUserId");
  const apiDeviceId = document.getElementById("apiDeviceId");
  const apiToken = document.getElementById("apiToken");
  const partnerConsent = document.getElementById("partnerConsent");
  const partnerProHint = document.getElementById("partnerProHint");
  const testPartner = document.getElementById("testPartner");
  const remoteDeltaUrl = document.getElementById("remoteDeltaUrl");
  const signedManifestUrl = document.getElementById("signedManifestUrl");
  const manifestPublicKeyJwk = document.getElementById("manifestPublicKeyJwk");
  const telemetryEnabled = document.getElementById("telemetryEnabled");
  const reportEmail = document.getElementById("reportEmail");
  const reportDomain = document.getElementById("reportDomain");
  const reportReason = document.getElementById("reportReason");
  const submitReport = document.getElementById("submitReport");
  const reportStatus = document.getElementById("reportStatus");
  const saveSettings = document.getElementById("saveSettings");
  const saveStatus = document.getElementById("saveStatus");

  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  keywordBlockingEnabled.checked = Boolean(state.settings.keywordBlockingEnabled);
  planStatus.textContent = `Current plan: ${state.settings.planCode || "free"}`;
  partnerProHint.textContent = state.settings.featureFlags?.partnerRelay
    ? "Partner relay is enabled for your plan."
    : "Partner relay requires Pro.";
  rulesetCore.checked = getCoreRulesetIds().every((id) =>
    (state.settings.enabledRulesets || []).includes(id)
  );
  rulesetSafe.checked = (state.settings.enabledRulesets || []).includes("safebrowsing_redirects");
  protectionEnabled.checked = Boolean(state.settings.protectionEnabled);
  if (state.settings.protectionDisableUnlockAt > Date.now()) {
    disableStatus.textContent = `Disable pending until ${new Date(
      state.settings.protectionDisableUnlockAt
    ).toLocaleString()}`;
  }
  keywordList.value = (state.settings.keywordList || []).join(", ");
  partnerLabel.value = state.settings.partnerLabel || "";
  apiBaseUrl.value = state.settings.apiBaseUrl || "https://api.puresignal.io";
  apiUserId.value = state.settings.apiUserId || "";
  apiDeviceId.value = state.settings.apiDeviceId || "";
  apiToken.value = state.settings.apiToken || "";
  partnerConsent.checked = Boolean(state.settings.partnerConsent);
  remoteDeltaUrl.value = state.settings.remoteDeltaUrl || "";

  const currentApiBase = state.settings.apiBaseUrl || "";
  const computedManifestUrl = currentApiBase ? `${currentApiBase}/v1/blocklist/manifest` : "";
  signedManifestUrl.value = state.settings.signedManifestUrl || "";
  signedManifestUrl.placeholder = computedManifestUrl || "Enter manifest URL or set API Base URL first";

  manifestPublicKeyJwk.value = state.settings.manifestPublicKeyJwk || "";
  if (!manifestPublicKeyJwk.value && currentApiBase) {
    manifestPublicKeyJwk.placeholder = "Auto-fetched from API on startup";
  }

  telemetryEnabled.checked = Boolean(state.settings.telemetryEnabled);
  renderWhitelist(state.whitelistEntries || []);

  apiBaseUrl.addEventListener("change", () => {
    const base = apiBaseUrl.value.trim();
    if (base && !signedManifestUrl.value) {
      signedManifestUrl.placeholder = `${base}/v1/blocklist/manifest`;
    }
  });

  requestDisable.addEventListener("click", async () => {
    const ok = await requirePassword();
    if (!ok) {
      disableStatus.textContent = "Incorrect password.";
      return;
    }
    const reason = disableReason.value.trim();
    if (!reason) {
      disableStatus.textContent = "Add a reason before requesting disable.";
      return;
    }
    const result = await chrome.runtime.sendMessage({
      type: "REQUEST_DISABLE_PROTECTION",
      payload: { reason }
    });
    disableStatus.textContent = `Disable requested. Protection unlocks at ${new Date(
      result.unlockAt
    ).toLocaleString()}.`;
    protectionEnabled.checked = true;
  });

  cancelDisable.addEventListener("click", async () => {
    const ok = await requirePassword();
    if (!ok) {
      disableStatus.textContent = "Incorrect password.";
      return;
    }
    await chrome.runtime.sendMessage({ type: "CANCEL_DISABLE_PROTECTION" });
    disableStatus.textContent = "Disable request canceled.";
  });

  addWhitelist.addEventListener("click", async () => {
    const ok = await requirePassword();
    if (!ok) {
      saveStatus.textContent = "Incorrect password.";
      return;
    }

    const domain = cleanDomain(wlDomain.value);
    if (!domain || !domain.includes(".")) {
      saveStatus.textContent = "Enter a valid whitelist domain.";
      return;
    }
    await chrome.runtime.sendMessage({
      type: "ADD_WHITELIST",
      payload: { domain, reason: wlReason.value.trim() }
    });
    wlDomain.value = "";
    wlReason.value = "";
    const refreshed = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    renderWhitelist(refreshed.whitelistEntries || []);
    saveStatus.textContent = `Added ${domain} for 24 hours.`;
  });

  savePassword.addEventListener("click", async () => {
    if ((password.value || "").length < 8) {
      passwordStatus.textContent = "Use at least 8 characters.";
      return;
    }
    const payload = await hashPassword(password.value);
    await chrome.storage.local.set({ [SETTINGS_PASSWORD_KEY]: payload });
    password.value = "";
    passwordStatus.textContent = "Password saved.";
  });

  testPartner.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({ type: "PARTNER_TEST" });
    saveStatus.textContent = response?.ok ? "Test alert sent." : response?.error || "Partner test failed.";
  });

  submitReport.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({
      type: "REPORT_FALSE_POSITIVE",
      payload: {
        email: reportEmail.value.trim(),
        domain: cleanDomain(reportDomain.value),
        reason: reportReason.value.trim()
      }
    });
    reportStatus.textContent = response?.ok ? "Report submitted." : response?.error || "Report failed.";
  });

  saveSettings.addEventListener("click", async () => {
    const ok = await requirePassword();
    if (!ok) {
      saveStatus.textContent = "Incorrect password.";
      return;
    }

    if (!protectionEnabled.checked) {
      const settings = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
      if (!settings.protectionDisableUnlockAt || Date.now() < settings.protectionDisableUnlockAt) {
        saveStatus.textContent =
          "Protection cannot be turned off directly. Use Request disable and wait 30 minutes.";
        protectionEnabled.checked = true;
        return;
      }
    }

    const current = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
    const payload = {
      ...current,
      protectionEnabled: protectionEnabled.checked,
      keywordBlockingEnabled: keywordBlockingEnabled.checked,
      enabledRulesets: [
        ...(rulesetCore.checked ? getCoreRulesetIds() : []),
        ...(rulesetSafe.checked ? ["safebrowsing_redirects"] : [])
      ],
      keywordList: keywordList.value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      partnerLabel: partnerLabel.value.trim(),
      apiBaseUrl: apiBaseUrl.value.trim(),
      apiUserId: apiUserId.value.trim(),
      apiDeviceId: apiDeviceId.value.trim(),
      apiToken: apiToken.value.trim(),
      partnerConsent: partnerConsent.checked,
      remoteDeltaUrl: remoteDeltaUrl.value.trim(),
      signedManifestUrl: signedManifestUrl.value.trim(),
      manifestPublicKeyJwk: manifestPublicKeyJwk.value.trim(),
      telemetryEnabled: telemetryEnabled.checked
    };

    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", payload });
    saveStatus.textContent = "Settings saved.";
  });
}

init();
