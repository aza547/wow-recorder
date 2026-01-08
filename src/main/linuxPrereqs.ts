import { spawnSync } from 'child_process';
import fs from 'fs';

const binaryExists = (name: string) => {
  // First try PATH.
  const res = spawnSync('bash', ['-lc', `command -v ${name} >/dev/null 2>&1`]);
  if (res.status === 0) return true;

  // Common non-PATH locations (portals often live under /usr/lib).
  const candidates = [
    `/usr/bin/${name}`,
    `/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/lib/${name}`,
    `/usr/libexec/${name}`,
    `/run/current-system/sw/bin/${name}`, // NixOS
  ];

  return candidates.some((p) => fs.existsSync(p));
};

const serviceActiveSystemdUser = (unit: string) => {
  if (!binaryExists('systemctl')) return null;
  const res = spawnSync('systemctl', ['--user', 'is-active', unit], {
    encoding: 'utf-8',
  });
  if (res.status === 0) return true;
  if (res.status === 3) return false; // inactive/failed
  return null; // unknown
};

const processRunning = (name: string) => {
  if (!binaryExists('pgrep')) return null;
  const res = spawnSync('pgrep', ['-x', name], { encoding: 'utf-8' });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  return null;
};

export const checkLinuxRuntimePrereqs = () => {
  const messages: string[] = [];

  if (process.platform !== 'linux') {
    return messages;
  }

  const sessionType = process.env.XDG_SESSION_TYPE || 'unknown';
  const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
  const desktop =
    process.env.XDG_CURRENT_DESKTOP ||
    process.env.DESKTOP_SESSION ||
    process.env.GDMSESSION ||
    'unknown';

  // Recorder backend assumptions.
  if (sessionType !== 'wayland' || !waylandDisplay) {
    messages.push(
      `Linux recording currently uses Wayland portal capture (xdg-desktop-portal). Detected session: XDG_SESSION_TYPE=${sessionType}, WAYLAND_DISPLAY=${waylandDisplay || 'unset'}. Switch to a Wayland session or implement X11 capture modes.`,
    );
  }

  if (!binaryExists('gpu-screen-recorder')) {
    messages.push(
      'Missing dependency: gpu-screen-recorder (required for recording on Linux). Install it and ensure it is in PATH.',
    );
  }

  // Portal / PipeWire (Wayland capture).
  if (!binaryExists('xdg-desktop-portal')) {
    messages.push(
      'Missing dependency: xdg-desktop-portal (required for Wayland screen capture via portal). Install it and a suitable backend (see below).',
    );
  }

  const portalBackends = [
    'xdg-desktop-portal-hyprland',
    'xdg-desktop-portal-wlr',
    'xdg-desktop-portal-kde',
    'xdg-desktop-portal-gnome',
    'xdg-desktop-portal-gtk',
    'xdg-desktop-portal-lxqt',
  ];

  const hasBackend = portalBackends.some(binaryExists);
  if (!hasBackend) {
    messages.push(
      `No xdg-desktop-portal backend detected for desktop "${desktop}". Install one of: ${portalBackends.join(
        ', ',
      )}.`,
    );
  }

  const portalActive =
    serviceActiveSystemdUser('xdg-desktop-portal') ??
    processRunning('xdg-desktop-portal');
  if (portalActive === false) {
    messages.push(
      'xdg-desktop-portal is not running (user service). Try restarting it: systemctl --user restart xdg-desktop-portal',
    );
  }

  const pipewireActive =
    serviceActiveSystemdUser('pipewire') ?? processRunning('pipewire');
  if (pipewireActive === false) {
    messages.push(
      'PipeWire is not running (required for portal capture/audio). Start it (often via systemctl --user start pipewire) and ensure xdg-desktop-portal is using PipeWire.',
    );
  }

  return messages;
};
