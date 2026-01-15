const fs = require('fs');
const path = require('path');

// TODO: [linux-port] linux-specific library pathing weirdness
//       revisit this -- I'm not a fan of this. I blame electron.
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

NOOBS_BIN="$SCRIPT_DIR/resources/app.asar.unpacked/node_modules/noobs/dist/bin"
export LD_LIBRARY_PATH="$NOOBS_BIN:$LD_LIBRARY_PATH"
export PATH="$NOOBS_BIN:$PATH"

# Force avcocdec for aac_encode
AVCODEC_PATH="$NOOBS_BIN/libavcodec.so.62"
# Force our libobs to load after that, to resolve its des
LIBOBS_PATH="$NOOBS_BIN/libobs.so.30"
# Force x264 without memalign/huge pages
LIBX264_PATH="$NOOBS_BIN/libx264.so.165"

// TODO: [linux-port] We need to package _all_ of ffmpeg's av* libraries and load them via LD_LIBRARY_PATH.
//                    Putting it in preload is a stopgap to enable dev
//                    libobs still needs to be preloaded to prevent electron's ffmpeg from loading the wrong codec libs
export LD_PRELOAD="$AVCODEC_PATH $LIBOBS_PATH $LIBX264_PATH"

exec "$SCRIPT_DIR/${executableName}-bin" "$@"
`;
  
  fs.writeFileSync(wrapperScript, wrapperContent, { mode: 0o755 });
};
// TODO: [linux-port] END
