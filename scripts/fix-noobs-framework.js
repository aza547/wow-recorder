/**
 * electron-builder afterPack hook (macOS only).
 *
 * The noobs Mac dist tarball strips libobs.framework's canonical
 * symlink layout (`Versions/Current`, `libobs`, `Headers`, `Resources`
 * at the framework root) so electron-builder's recursive copier
 * doesn't trip over them with ENOENT during the .app pack. Once the
 * framework is inside the bundle, codesign requires the canonical
 * layout — without it the framework is rejected as "bundle format
 * unrecognized, invalid, or unsuitable".
 *
 * This hook re-creates those symlinks post-pack but pre-sign so
 * codesign accepts the framework. Idempotent.
 */

const path = require('path');
const fs = require('fs');

function repairFramework(fwPath) {
  const versionsDir = path.join(fwPath, 'Versions');
  if (!fs.existsSync(versionsDir)) return 0;

  const versions = fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (versions.length === 0) return 0;

  let added = 0;
  const current = versions.includes('A') ? 'A' : versions[0];
  const currentLink = path.join(versionsDir, 'Current');
  if (!fs.existsSync(currentLink)) {
    fs.symlinkSync(current, currentLink);
    added++;
  }

  const versionDir = path.join(versionsDir, current);
  for (const name of fs.readdirSync(versionDir)) {
    const topLink = path.join(fwPath, name);
    try {
      fs.lstatSync(topLink);
      continue;
    } catch {
      // missing — fall through and create
    }
    try {
      fs.symlinkSync(path.join('Versions', 'Current', name), topLink);
      added++;
    } catch (err) {
      console.warn('[fix-noobs-framework] symlink failed', topLink, err.message);
    }
  }
  return added;
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let added = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.endsWith('.framework')) {
      added += repairFramework(full);
    } else {
      added += walk(full);
    }
  }
  return added;
}

/**
 * obs-ffmpeg.plugin spawns its mux helper via
 * `os_get_executable_path_ptr("obs-ffmpeg-mux")`, which on macOS
 * resolves to `<host_executable_dir>/obs-ffmpeg-mux` — i.e.
 * `Contents/MacOS/obs-ffmpeg-mux` for the host Electron app, NOT the
 * `noobs/dist/Frameworks/` directory where the helper actually ships.
 * Without a copy at that path, recording fails with
 * "Failed to create process pipe" / "Unable to start the recording
 * helper process".
 *
 * Copy the helper from the bundled noobs/dist/Frameworks/ into
 * Contents/MacOS/ so the plugin finds it. Done in afterPack so
 * electron-builder's deep-sign covers it.
 */
function placeFfmpegMuxHelper(appOutDir) {
  // Find the .app
  const appName = fs
    .readdirSync(appOutDir)
    .find((n) => n.endsWith('.app'));
  if (!appName) return false;
  const appPath = path.join(appOutDir, appName);
  const macOsDir = path.join(appPath, 'Contents', 'MacOS');
  const helperSrc = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'noobs',
    'dist',
    'Frameworks',
    'obs-ffmpeg-mux',
  );
  const helperDst = path.join(macOsDir, 'obs-ffmpeg-mux');
  if (!fs.existsSync(helperSrc)) {
    console.warn(`[fix-noobs-framework] helper missing at ${helperSrc}`);
    return false;
  }
  fs.copyFileSync(helperSrc, helperDst);
  fs.chmodSync(helperDst, 0o755);

  // The helper depends on libavcodec / libavformat / libavutil etc.
  // via @rpath. Its baked rpath points at @executable_path/../Frameworks
  // which, from Contents/MacOS/, lands in Electron's Frameworks
  // directory — not noobs/dist/Frameworks where the libs actually
  // live. Add the noobs path so dyld resolves siblings at runtime.
  const noobsFrameworksRpath =
    '@loader_path/../Resources/app/node_modules/noobs/dist/Frameworks';
  try {
    require('child_process').execFileSync(
      'install_name_tool',
      ['-add_rpath', noobsFrameworksRpath, helperDst],
      { stdio: 'inherit' },
    );
    console.log(
      `[fix-noobs-framework] copied obs-ffmpeg-mux → ${helperDst} (+rpath ${noobsFrameworksRpath})`,
    );
  } catch (err) {
    console.warn(
      `[fix-noobs-framework] install_name_tool failed on mux helper: ${err.message}`,
    );
  }
  return true;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const root = context.appOutDir;
  const added = walk(root);
  console.log(`[fix-noobs-framework] ${added} symlinks added under ${root}`);
  placeFfmpegMuxHelper(root);
};
