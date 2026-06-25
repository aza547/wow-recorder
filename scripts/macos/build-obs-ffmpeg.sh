#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

OBS_VERSION="${OBS_VERSION:-30.2.3}"
ARCH="${ARCH:-$(uname -m)}"
BUILD_ROOT="${BUILD_ROOT:-${ROOT_DIR}/native/macos/build}"
SOURCE_DIR="${SOURCE_DIR:-${BUILD_ROOT}/obs-studio-${OBS_VERSION}}"
BUILD_DIR="${SOURCE_DIR}/build_macos"

REPLAY_PATCH="${ROOT_DIR}/native/macos/patches/obs-${OBS_VERSION}-replay-buffer-convert.patch"
LOCAL_BUILD_PATCH="${ROOT_DIR}/native/macos/patches/obs-${OBS_VERSION}-local-build.patch"

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "required file not found: ${path}" >&2
    exit 1
  fi
}

apply_patch_once() {
  local patch_file="$1"
  local label="$2"
  local marker_file="$3"
  local marker="$4"

  if git -C "${SOURCE_DIR}" apply --reverse --check "${patch_file}" >/dev/null 2>&1; then
    echo "Already applied: ${label}"
    return
  fi

  if git -C "${SOURCE_DIR}" grep -q "${marker}" -- "${marker_file}" >/dev/null 2>&1; then
    echo "Already applied: ${label}"
    return
  fi

  echo "Applying: ${label}"
  git -C "${SOURCE_DIR}" apply --check "${patch_file}"
  git -C "${SOURCE_DIR}" apply "${patch_file}"
}

require_file "${REPLAY_PATCH}"
require_file "${LOCAL_BUILD_PATCH}"

mkdir -p "${BUILD_ROOT}"

if [[ ! -d "${SOURCE_DIR}/.git" ]]; then
  git clone --recursive --depth 1 --branch "${OBS_VERSION}" \
    https://github.com/obsproject/obs-studio.git "${SOURCE_DIR}"
else
  echo "Using existing OBS checkout: ${SOURCE_DIR}"
fi

apply_patch_once \
  "${REPLAY_PATCH}" \
  "Warcraft Recorder replay-buffer convert backport" \
  "plugins/obs-ffmpeg/obs-ffmpeg-mux.h" \
  "convert_offset_sec"

apply_patch_once \
  "${LOCAL_BUILD_PATCH}" \
  "local obs-ffmpeg-only macOS build patch" \
  "plugins/CMakeLists.txt" \
  "add_obs_plugin(obs-ffmpeg)"

cmake -S "${SOURCE_DIR}" --preset macos \
  -DCMAKE_OSX_ARCHITECTURES:STRING="${ARCH}" \
  -DENABLE_BROWSER:BOOL=OFF \
  -DENABLE_UI:BOOL=OFF \
  -DENABLE_SCRIPTING:BOOL=OFF \
  -DENABLE_NEW_MPEGTS_OUTPUT:BOOL=OFF \
  -DENABLE_AJA:BOOL=OFF \
  -DENABLE_DECKLINK:BOOL=OFF \
  -DENABLE_VIRTUALCAM:BOOL=OFF \
  -DENABLE_WEBRTC:BOOL=OFF

cmake --build "${BUILD_DIR}" --config RelWithDebInfo --target obs-ffmpeg
cmake --build "${BUILD_DIR}" --config RelWithDebInfo --target obs-ffmpeg-mux

"${ROOT_DIR}/scripts/macos/stage-obs-artifacts.sh" \
  "${BUILD_DIR}/plugins/obs-ffmpeg/RelWithDebInfo/obs-ffmpeg.plugin" \
  "${BUILD_DIR}/plugins/obs-ffmpeg/ffmpeg-mux/RelWithDebInfo/obs-ffmpeg-mux"
