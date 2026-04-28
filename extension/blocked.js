async function init() {
  const streakText = document.getElementById("streakText");
  const urgeNote = document.getElementById("urgeNote");
  const urgeStatus = document.getElementById("urgeStatus");
  const saveUrge = document.getElementById("saveUrge");
  const breathing = document.getElementById("breathing");
  const startBreathing = document.getElementById("startBreathing");
  const openOptions = document.getElementById("openOptions");

  await chrome.runtime.sendMessage({
    type: "BLOCKED_ATTEMPT",
    payload: { url: document.referrer || "unknown" }
  });

  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  streakText.textContent = `Current streak: ${state.stats.streakDays || 0} day(s). Blocked attempts: ${
    state.stats.blockedAttempts || 0
  }.`;

  saveUrge.addEventListener("click", async () => {
    const note = urgeNote.value.trim();
    if (!note) {
      urgeStatus.textContent = "Add a short note before saving.";
      return;
    }
    await chrome.runtime.sendMessage({
      type: "LOG_URGE",
      payload: { note, at: Date.now() }
    });
    urgeNote.value = "";
    urgeStatus.textContent = "Urge logged.";
  });

  startBreathing.addEventListener("click", () => {
    let remaining = 60;
    breathing.textContent = `Breathing timer: ${remaining}s remaining. Inhale slowly.`;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        breathing.textContent = "Breathing timer complete. You just made space for a better choice.";
        return;
      }
      breathing.textContent = `Breathing timer: ${remaining}s remaining.`;
    }, 1000);
  });

  openOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init();
