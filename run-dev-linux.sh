#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

NOOBS_BIN="$SCRIPT_DIR/release/app/node_modules/noobs/dist/bin/linux"

# Electron's libffmpeg.so exports the same av_* symbols and loads first.
PRELOAD="$NOOBS_BIN/libavutil-noobs.so.60 $NOOBS_BIN/libavcodec-noobs.so.62 $NOOBS_BIN/libavformat-noobs.so.62"

for so in $PRELOAD; do
  [[ -r "$so" ]] || { echo "missing: $so" >&2; exit 1; }
done

# Force the X11 Ozone backend. Electron 42+ defaults to Wayland.
LD_PRELOAD="$PRELOAD" \
  PATH="$NOOBS_BIN:$PATH" \
  XDG_SESSION_TYPE=x11 \
  exec npm run start
