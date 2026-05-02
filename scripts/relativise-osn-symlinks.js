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
 * electron-builder's FileCopier dereferences symlinks during `dir`
 * packaging in some versions, so the bundled OSN tree loses the
 * unversioned name → versioned-binary symlinks that OSN's runtime
 * loaders expect (e.g. `obs_studio_client.node` →
 * `obs_studio_client.0.3.21.0.node`, `bin/libcurl.4.dylib` →
 * `libcurl.4.8.0.dylib` — the latter is what obs64 looks up via
 * `@rpath/libcurl.4.dylib` and dies with dyld "Library not loaded"
 * if the symlink isn't there).
 *
 * Walk the source OSN tree (the `release/app/node_modules/obs-studio-
 * node/` we ship from), enumerate every symlink, and for each one
 * that's missing in the bundled tree, recreate it with the same
 * target. We skip OSN.app since dropOsnApp deletes it. Skips the
 * Frameworks tree as well — fixFrameworkLayout handles those.
 */
function replayOsnSymlinks(appPath) {
  const srcOsnRoot = path.resolve(
    __dirname,
    '..',
    'release',
    'app',
    'node_modules',
    'obs-studio-node',
  );
  const dstOsnRoot = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
  );
  if (!fs.existsSync(srcOsnRoot) || !fs.existsSync(dstOsnRoot)) {
    console.warn('[relativise-osn] cannot replay symlinks — root missing');
    return;
  }
  let recreated = 0;
  let alreadyPresent = 0;
  let skipped = 0;
  function walk(rel) {
    const srcDir = path.join(srcOsnRoot, rel);
    let entries;
    try {
      entries = fs.readdirSync(srcDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = path.join(rel, entry.name);
      // OSN.app gets deleted by dropOsnApp; framework symlinks are
      // owned by fixFrameworkLayout. Skip both.
      if (entry.name === 'OSN.app') continue;
      if (entry.name.endsWith('.framework')) continue;
      const srcChild = path.join(srcOsnRoot, childRel);
      const dstChild = path.join(dstOsnRoot, childRel);
      if (entry.isSymbolicLink()) {
        let exists = true;
        try {
          fs.lstatSync(dstChild);
        } catch {
          exists = false;
        }
        if (exists) {
          alreadyPresent++;
          continue;
        }
        const target = fs.readlinkSync(srcChild);
        if (path.isAbsolute(target)) {
          // Absolute symlinks are handled by `relativise()` in the
          // already-bundled tree. If we're here, the bundled copy
          // doesn't exist at all — best-effort skip.
          skipped++;
          continue;
        }
        try {
          fs.mkdirSync(path.dirname(dstChild), { recursive: true });
          fs.symlinkSync(target, dstChild);
          console.log(
            '[relativise-osn] recreated symlink',
            childRel,
            '→',
            target,
          );
          recreated++;
        } catch (err) {
          console.warn(
            '[relativise-osn] failed to recreate',
            childRel,
            err.message,
          );
        }
      } else if (entry.isDirectory()) {
        walk(childRel);
      }
    }
  }
  walk('');
  console.log(
    `[relativise-osn] replayed symlinks: ${recreated} recreated, ${alreadyPresent} already present, ${skipped} skipped`,
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
  replayOsnSymlinks(appPath);
};
