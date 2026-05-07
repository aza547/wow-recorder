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

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const root = context.appOutDir;
  const added = walk(root);
  console.log(`[fix-noobs-framework] ${added} symlinks added under ${root}`);
};
