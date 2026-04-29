/**
 * electron-builder afterPack hook.
 *
 * OSN ships absolute symlinks pointing at the source repo (e.g.
 * `OSN.app/Contents/Frameworks/ffmpeg →
 *  /Users/.../release/app/node_modules/obs-studio-node/.../ffmpeg`).
 * codesign --verify --deep --strict (which electron-builder runs after
 * signing, BEFORE afterSign) rejects symlinks pointing outside the
 * bundle as "invalid destination for symbolic link in bundle".
 *
 * Walk the bundle and, for every absolute symlink whose target lives
 * inside the source-repo OSN tree, rewrite it to a bundle-relative
 * path. Skip anything whose target is genuinely external.
 */
const path = require('path');
const fs = require('fs');

function relativise(appPath) {
  const repoSrcOsnRoot = path.resolve(
    __dirname,
    '..',
    'release',
    'app',
    'node_modules',
    'obs-studio-node',
  );
  const bundledOsnRoot = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
  );
  let fixed = 0;
  let skipped = 0;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = fs.readlinkSync(full);
        } catch {
          continue;
        }
        if (!path.isAbsolute(target)) continue;
        let mapped;
        if (target.startsWith(repoSrcOsnRoot)) {
          mapped = path.join(
            bundledOsnRoot,
            target.slice(repoSrcOsnRoot.length),
          );
        }
        if (!mapped || !fs.existsSync(mapped)) {
          console.warn(
            '[relativise-osn] cannot relativise',
            full,
            '→',
            target,
          );
          skipped++;
          continue;
        }
        const rel = path.relative(path.dirname(full), mapped);
        fs.unlinkSync(full);
        fs.symlinkSync(rel, full);
        fixed++;
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  }
  walk(appPath);
  console.log(
    `[relativise-osn] symlinks: ${fixed} relativised, ${skipped} skipped`,
  );
}

module.exports = async function (context) {
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  if (!fs.existsSync(appPath)) {
    console.warn('[relativise-osn] app not found:', appPath);
    return;
  }
  console.log('[relativise-osn] walking', appPath);
  relativise(appPath);
};
