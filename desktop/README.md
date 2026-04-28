# PureSignal Desktop (Hosts-first MVP)

## Implemented in this phase

- Hosts-based blocking engine with backup and restore flows.
- Device registration call to platform API.
- Signed manifest sync placeholder.
- Diagnostics shell output for tray/menu-bar phase.

## Commands

- `npm run dev -- register` - register desktop device.
- `npm run dev -- apply` - sync manifest and apply hosts blocklist.
- `npm run dev -- diagnostics` - print diagnostics.
- `npm run dev -- restore` - restore hosts backup.

## Installer and signing checklist

- macOS: signed app + notarization + launch agent.
- Windows: signed installer + startup task registration.
- Linux: package + service unit options.

## Safety notes

- Always back up system hosts before writing.
- Never overwrite unmanaged host entries.
- Surface clear warnings for privilege escalation and restore options.
