# Warcraft Recorder

Warcraft Recorder watches the World of Warcraft combat log and automatically records videos for “interesting” activities (arenas, raids, dungeons, etc).

## Supported Platforms

| OS | Support |
|---|---|
| Windows | Yes |
| Linux (Wayland) | Yes (MVP) |
| macOS | No |

| WoW flavour | Support |
|---|---|
| Retail | Yes |
| MoP Classic | Yes |
| Classic Era | SoD Raids Only |

## Quick Start

1. Install a combat logging addon and enable Advanced Combat Logging when prompted:
   - Retail: SimpleCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/simplecombatlogger), [Wago](https://addons.wago.io/addons/simplecombatlogger)).
   - Classic / Classic Era: AutoCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/autocombatlogger), [Wago](https://addons.wago.io/addons/autocombatlogger)).
2. In Warcraft Recorder settings:
   - Choose a Storage Path for videos.
   - Set the WoW `Logs` folder for the flavour(s) you play.
3. Use the Test button with WoW running to validate recording end-to-end.

## Linux (Wayland) Behavior

Linux uses `gpu-screen-recorder` (GSR) instead of OBS.

- Capture is portal-based (PipeWire + XDG Desktop Portal). On first start (or after “Re-select Capture Target”), you must select the WoW window/monitor in the system share dialog.
- Recording is fully automatic (start/stop is driven by combat log activity detection).
- The “Replay buffer” is only used for pre-roll; full activities are recorded as regular recordings and are not limited by the buffer length.

### Linux Requirements

Required on most Wayland setups:
- `gpu-screen-recorder`
- PipeWire
- `xdg-desktop-portal`
- A portal backend for your compositor/DE (e.g. `xdg-desktop-portal-hyprland`, `xdg-desktop-portal-gnome`, `xdg-desktop-portal-kde`, `xdg-desktop-portal-wlr`)

The app performs best-effort runtime checks and reports missing prerequisites via the in-app error indicator.

## Building / Packaging (AppImage)

Linux packaging produces an AppImage:

- `npm install`
- `npm run package:linux`

Use Node 22 LTS (or Node 20 LTS) for packaging.

## Contributing

See `docs/CONTRIBUTING.md`.

## Credits

- Windows recording is based on [OBS](https://obsproject.com/).
- Linux recording uses [gpu-screen-recorder](https://git.dec05eba.com/gpu-screen-recorder/about/).
- Built with [Electron](https://www.electronjs.org/) and [React](https://react.dev/) (ERB).
