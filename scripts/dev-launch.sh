#!/usr/bin/env bash
# Dev launcher for the signed mac bundle. macOS 26 Gatekeeper kills the
# chrome_crashpad_handler subprocess when the app is started via `open`
# / Finder for unnotarized Developer ID builds. Direct binary launch
# inherits the terminal's looser sandbox envelope and stays alive.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)/release/build/mac-arm64/WarcraftRecorder.app"
exec "$APP/Contents/MacOS/WarcraftRecorder" "$@"
