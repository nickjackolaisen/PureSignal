function cleanDomain(input) {
  return String(input || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

async function init() {
  const streak = document.getElementById("streak");
  const attempts = document.getElementById("attempts");
  const protectionStatus = document.getElementById("protectionStatus");
  const planBadge = document.getElementById("planBadge");
  const upgradeButton = document.getElementById("upgradeButton");
  const domain = document.getElementById("domain");
  const reason = document.getElementById("reason");
  const addWhitelist = document.getElementById("addWhitelist");
  const whitelistStatus = document.getElementById("whitelistStatus");
  const openOptions = document.getElementById("openOptions");

  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const unlockAt = state.settings.protectionDisableUnlockAt || 0;
  if (!state.settings.protectionEnabled) {
    protectionStatus.textContent = "Protection is currently disabled.";
  } else if (unlockAt > Date.now()) {
    protectionStatus.textContent = `Disable requested, unlock at ${new Date(unlockAt).toLocaleTimeString()}.`;
  } else {
    protectionStatus.textContent = "Protection is active.";
  }
  streak.textContent = `Streak: ${state.stats.streakDays || 0} day(s)`;
  attempts.textContent = `Blocked attempts: ${state.stats.blockedAttempts || 0}`;
  planBadge.textContent = `Plan: ${state.settings.planCode || "free"}`;
  upgradeButton.style.display = state.settings.planCode === "free" ? "block" : "none";
  upgradeButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://puresignal.io/pricing" });
  });

  addWhitelist.addEventListener("click", async () => {
    const normalized = cleanDomain(domain.value);
    if (!normalized || !normalized.includes(".")) {
      whitelistStatus.textContent = "Enter a valid domain.";
      return;
    }
    await chrome.runtime.sendMessage({
      type: "ADD_WHITELIST",
      payload: { domain: normalized, reason: reason.value.trim() }
    });
    whitelistStatus.textContent = `Added ${normalized} for 24 hours.`;
    domain.value = "";
    reason.value = "";
  });

  openOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init();
