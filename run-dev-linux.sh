#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

NOOBS_BIN="$SCRIPT_DIR/release/app/node_modules/noobs/dist/bin"
BIN_PATH=PATH="$NOOBS_BIN:$PATH"

# setup LD_LIBRARY_PATH to point to noobs for self-resolution
LD_LIB_PATH="$NOOBS_BIN${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# Force avcodec for aac_encode
AVCODEC_PATH="$NOOBS_BIN/libavcodec.so.62"
# Force our libobs to load after that, to resolve its des
LIBOBS_PATH="$NOOBS_BIN/libobs.so.30"
# Force x264 without memalign/huge pages
LIBX264_PATH="$NOOBS_BIN/libx264.so.165"

# Optional: sanity checks so it fails loudly instead of silently not preloading
for so in "$AVCODEC_PATH" "$LIBX264_PATH"; do
  [[ -r "$so" ]] || { echo "missing: $so" >&2; exit 1; }
done

# force our vended ffmpeg and x264 binaries
# the kids in the electron sandbox are fighting
# load order matters
LD_PRELOAD="$AVCODEC_PATH $LIBOBS_PATH $LIBX264_PATH" \
  LD_LIBRARY_PATH="$LD_LIB_PATH" \
  PATH="$BIN_PATH" \
  exec npm run start

