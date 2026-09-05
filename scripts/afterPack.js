const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'linux') {
    return;
  }

  const appOutDir = context.appOutDir;
  const executableName = context.packager.executableName;

  const originalBinary = path.join(appOutDir, executableName);
  const renamedBinary = path.join(appOutDir, `${executableName}-bin`);
  const wrapperScript = path.join(appOutDir, executableName);

  // Rename the original binary
  fs.renameSync(originalBinary, renamedBinary);

  // Create the wrapper script
  const wrapperContent = `#!/bin/bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

NOOBS_BIN="$SCRIPT_DIR/resources/app.asar.unpacked/node_modules/noobs/dist/bin/linux"
export PATH="$NOOBS_BIN:$PATH"

# Electron's libffmpeg.so exports the same av_* symbols and loads first.
export LD_PRELOAD="$NOOBS_BIN/libavutil-noobs.so.60 $NOOBS_BIN/libavcodec-noobs.so.62 $NOOBS_BIN/libavformat-noobs.so.62"

# Force the X11 Ozone backend. Chromium 140 / Electron 42 defaults
# --ozone-platform-hint to auto, so a Wayland wins.
exec "$SCRIPT_DIR/${executableName}-bin" --ozone-platform=x11 "$@"
`;

  fs.writeFileSync(wrapperScript, wrapperContent, { mode: 0o755 });
};
