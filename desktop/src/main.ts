import "dotenv/config";
import { applyHostsBlocklist, restoreHostsBackup } from "./system-hosts.js";
import { syncManifest } from "./updater.js";
import { getEntitlements, registerDevice } from "./platform-client.js";
import { printDiagnostics, startTrayLoop } from "./ui-shell.js";

async function run() {
  const mode = process.argv[2] || "start";

  if (mode === "register") {
    const result = await registerDevice();
    console.log("Registered device:", result);
    return;
  }

  if (mode === "restore") {
    await restoreHostsBackup();
    console.log("Hosts backup restored.");
    return;
  }

  if (mode === "diagnostics") {
    await printDiagnostics();
    return;
  }

  if (mode === "apply") {
    const entitlements = await getEntitlements().catch(() => ({ planCode: "free", flags: {} }));
    if (entitlements.planCode === "free") {
      console.log("Running in free desktop mode.");
    } else {
      console.log(`Running in paid desktop mode: ${entitlements.planCode}`);
    }
    await syncManifest();
    await applyHostsBlocklist();
    console.log("Hosts blocklist applied.");
    return;
  }

  await startTrayLoop();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
