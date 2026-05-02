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

/**
 * Some OSN frameworks ship as `Foo.framework/Versions/A/...` with no
 * `Versions/Current` symlink and no top-level convenience symlinks
 * (`Foo`, `Resources`, `_CodeSignature`, …). codesign requires the
 * canonical layout or it bails with "bundle format unrecognized".
 *
 * For each `*.framework` directory containing a single `Versions/<X>/`
 * entry, create:
 *   - `Versions/Current` → `<X>`
 *   - top-level `<name>` → `Versions/Current/<name>` for every child of
 *     `Versions/<X>/`.
 */
function fixFrameworkLayout(appPath) {
  let fixed = 0;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.endsWith('.framework')) {
        repairFramework(full);
        // Don't recurse inside frameworks.
      } else {
        walk(full);
      }
    }
  }
  function repairFramework(fwPath) {
    const versionsDir = path.join(fwPath, 'Versions');
    if (!fs.existsSync(versionsDir)) return;
    const versions = fs
      .readdirSync(versionsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    if (versions.length === 0) return;
    const current = versions.includes('A') ? 'A' : versions[0];
    const currentLink = path.join(versionsDir, 'Current');
    if (!fs.existsSync(currentLink)) {
      fs.symlinkSync(current, currentLink);
      fixed++;
    }
    const versionDir = path.join(versionsDir, current);
    const versionEntries = fs.readdirSync(versionDir);
    for (const name of versionEntries) {
      const topLink = path.join(fwPath, name);
      try {
        fs.lstatSync(topLink);
        continue;
      } catch {
        // does not exist — create it
      }
      try {
        fs.symlinkSync(path.join('Versions', 'Current', name), topLink);
        fixed++;
      } catch (err) {
        console.warn(
          '[relativise-osn] symlink create failed',
          topLink,
          err.message,
        );
      }
    }
  }
  walk(appPath);
  console.log(`[relativise-osn] framework layout: ${fixed} symlinks added`);
}

/**
 * OSN ships a nested `OSN.app/` that duplicates the framework + binary
 * layout already present at the OSN package root. At runtime our
 * OsnBackend points IPC.setServerPath at `obs-studio-node/bin/obs64`
 * (root), and root obs64 resolves dylibs via
 * `@executable_path/../Frameworks/...` → `obs-studio-node/Frameworks/`,
 * so OSN.app is unused. It also fails codesign because `distribute/`
 * sits at the bundle root ("unsealed contents present in the bundle
 * root"). Drop it from the packaged build.
 *
 * `module.js` falls back to root paths when `OSN.app` is absent
 * (`hasDeveloperApp` flag).
 */
function dropOsnApp(appPath) {
  const osnAppPath = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
    'OSN.app',
  );
  if (!fs.existsSync(osnAppPath)) {
    console.log('[relativise-osn] OSN.app not present, skipping drop');
    return;
  }
  fs.rmSync(osnAppPath, { recursive: true, force: true });
  console.log('[relativise-osn] dropped OSN.app duplicate');
}

/**
 * OSN's npm package ships `obs_studio_client.node` as a relative
 * symlink → `obs_studio_client.<version>.node`. electron-builder's
 * file copier dereferences symlinks during `dir` packaging in some
 * versions, so the bundled tree ends up with only the versioned file
 * and `module.js`'s `require('./obs_studio_client.node')` blows up at
 * runtime.
 *
 * Look for a `obs_studio_client.<version>.node` next to a missing
 * `obs_studio_client.node` and recreate the symlink.
 */
function ensureClientNodeSymlink(appPath) {
  const osnRoot = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
  );
  if (!fs.existsSync(osnRoot)) return;
  const wanted = path.join(osnRoot, 'obs_studio_client.node');
  try {
    fs.lstatSync(wanted);
    console.log('[relativise-osn] obs_studio_client.node already present');
    return;
  } catch {
    // missing — try to recreate
  }
  const versioned = fs
    .readdirSync(osnRoot)
    .filter(
      (n) =>
        n.startsWith('obs_studio_client.') &&
        n.endsWith('.node') &&
        n !== 'obs_studio_client.node',
    );
  if (versioned.length !== 1) {
    console.warn(
      '[relativise-osn] cannot recreate obs_studio_client.node — found',
      versioned.length,
      'candidates:',
      versioned,
    );
    return;
  }
  fs.symlinkSync(versioned[0], wanted);
  console.log(
    '[relativise-osn] recreated obs_studio_client.node →',
    versioned[0],
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
  dropOsnApp(appPath);
  relativise(appPath);
  fixFrameworkLayout(appPath);
  ensureClientNodeSymlink(appPath);
};
