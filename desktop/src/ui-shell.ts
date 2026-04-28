import { hostsEntryCount } from "./system-hosts.js";
import { readManifest } from "./updater.js";

export async function printDiagnostics() {
  const count = await hostsEntryCount();
  const manifest = await readManifest();
  console.log("PureSignal diagnostics");
  console.log("Platform:", process.platform);
  console.log("Merged hosts entries:", count);
  console.log("Manifest version:", manifest.version || "none");
}

export async function startTrayLoop() {
  console.log("PureSignal desktop shell started.");
  console.log("Use menu actions in full desktop UI build (Electron/Tauri phase).");
  await printDiagnostics();
}
