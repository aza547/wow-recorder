#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

OBS_VERSION="${OBS_VERSION:-30.2.3}"
ARCH="${ARCH:-$(uname -m)}"

PLUGIN_SRC="${1:-/tmp/wcr-obs-30/build_macos/plugins/obs-ffmpeg/RelWithDebInfo/obs-ffmpeg.plugin}"
MUX_SRC="${2:-/tmp/wcr-obs-30/build_macos/plugins/obs-ffmpeg/ffmpeg-mux/RelWithDebInfo/obs-ffmpeg-mux}"

ARTIFACT_DIR="${ROOT_DIR}/native/macos/artifacts/obs-${OBS_VERSION}-${ARCH}"
PLUGIN_DEST="${ARTIFACT_DIR}/obs/OBS.app/Contents/WCRPlugIns/obs-ffmpeg.plugin"
MUX_DEST="${ARTIFACT_DIR}/app/Contents/MacOS/obs-ffmpeg-mux"
OBS_FRAMEWORKS_RPATH="${OBS_FRAMEWORKS_RPATH:-@executable_path/../Resources/obs/OBS.app/Contents/Frameworks}"

if [[ ! -d "${PLUGIN_SRC}" ]]; then
  echo "obs-ffmpeg.plugin not found: ${PLUGIN_SRC}" >&2
  exit 1
fi

if [[ ! -f "${MUX_SRC}" ]]; then
  echo "obs-ffmpeg-mux not found: ${MUX_SRC}" >&2
  exit 1
fi

rm -rf "${PLUGIN_DEST}" "${MUX_DEST}"
mkdir -p "$(dirname "${PLUGIN_DEST}")" "$(dirname "${MUX_DEST}")"

ditto "${PLUGIN_SRC}" "${PLUGIN_DEST}"
cp "${MUX_SRC}" "${MUX_DEST}"
chmod +x "${MUX_DEST}"

if ! otool -l "${MUX_DEST}" | grep -Fq "${OBS_FRAMEWORKS_RPATH}"; then
  install_name_tool -add_rpath "${OBS_FRAMEWORKS_RPATH}" "${MUX_DEST}"
fi

if command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - "${MUX_DEST}" >/dev/null 2>&1 || \
    echo "warning: failed to ad-hoc sign ${MUX_DEST}" >&2
fi

echo "Staged macOS OBS artifacts:"
echo "  ${PLUGIN_DEST}"
echo "  ${MUX_DEST}"
echo "  mux rpath: ${OBS_FRAMEWORKS_RPATH}"
echo
echo "Checksums:"
shasum -a 256 "${PLUGIN_DEST}/Contents/MacOS/obs-ffmpeg" "${MUX_DEST}"
