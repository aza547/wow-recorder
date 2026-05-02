/**
 * electron-builder afterSign hook.
 *
 * Walks the OSN tree inside the bundled .app and re-signs every native
 * binary, dylib, framework, helper-app, and OBS plugin with our
 * configured Developer ID. electron-builder's default pass only signs
 * the top-level app + its first-party Frameworks; OSN ships a deep
 * tree of third-party binaries that all need re-signing for hardened
 * runtime + macOS 26 sandbox checks to allow loading.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ENTITLEMENTS = path.resolve(
  __dirname,
  '..',
  'assets',
  'entitlements.mac.plist',
);

function resolveIdentity() {
  if (process.env.WCR_SIGN_IDENTITY) return process.env.WCR_SIGN_IDENTITY;
  const pkg = require('../package.json');
  const configured = pkg?.build?.mac?.identity || '-';

  // package.json keeps the short team-suffixed form ("Yuri Piratello
  // (Y36BG56F47)") because electron-builder rejects the
  // "Developer ID Application:" prefix. That short name is ambiguous on
  // machines that also carry an "Apple Distribution:" cert with the same
  // team, so codesign refuses to pick one. Resolve to the unambiguous
  // SHA-1 hash of the Developer ID Application cert here.
  if (configured === '-') return '-';
  try {
    const out = execFileSync(
      'security',
      ['find-identity', '-v', '-p', 'codesigning'],
      { encoding: 'utf8' },
    );
    const teamMatch = configured.match(/\(([A-Z0-9]{10})\)/);
    if (!teamMatch) return configured;
    const team = teamMatch[1];
    const lines = out.split('\n');
    const pick = (filter) =>
      lines
        .map((l) => l.match(/([A-F0-9]{40}) "([^"]+)"/))
        .filter((m) => m && m[2].includes(team) && filter(m[2]));
    const devId = pick((n) => n.startsWith('Developer ID Application:'));
    if (devId.length === 1) return devId[0][1]; // SHA-1 hash → unambiguous
    const any = pick(() => true);
    if (any.length === 1) return any[0][1];
    return configured;
  } catch (err) {
    console.warn('[sign-osn] identity resolution fell back:', err.message);
    return configured;
  }
}

function sign(target, identity, withEntitlements) {
  const args = [
    '--force',
    '--sign',
    identity,
    '--options',
    'runtime',
    '--timestamp=none',
  ];
  if (withEntitlements) {
    args.push('--entitlements', ENTITLEMENTS);
  }
  args.push(target);
  console.log('[sign-osn]', path.relative(process.cwd(), target));
  try {
    execFileSync('codesign', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (err) {
    console.error('[sign-osn] FAILED', target, err.message);
    throw err;
  }
}

function isMachO(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.readUInt32BE(0);
    return (
      magic === 0xfeedface || // 32-bit BE
      magic === 0xfeedfacf || // 64-bit BE
      magic === 0xcefaedfe || // 32-bit LE
      magic === 0xcffaedfe || // 64-bit LE
      magic === 0xcafebabe || // fat BE
      magic === 0xbebafeca // fat LE
    );
  } catch {
    return false;
  }
}

/**
 * Walk root, return signable items. Bundles (.app/.framework/.plugin)
 * appear AFTER their contents so deeper items are signed first.
 */
function findSignables(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (
          entry.name.endsWith('.app') ||
          entry.name.endsWith('.framework') ||
          entry.name.endsWith('.plugin')
        ) {
          walk(full);
          out.push(full);
        } else {
          walk(full);
        }
        continue;
      }
      if (entry.isFile() && isMachO(full)) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

module.exports = async function (context) {
  const identity = resolveIdentity();
  console.log('[sign-osn] identity:', identity);

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const osnRoot = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
  );

  if (!fs.existsSync(osnRoot)) {
    console.warn(
      '[sign-osn] OSN root not found at',
      osnRoot,
      '— main app already signed by electron-builder, skipping OSN pass.',
    );
    return;
  }

  console.log('[sign-osn] OSN root:', osnRoot);
  const targets = findSignables(osnRoot);
  console.log(
    `[sign-osn] Will sign ${targets.length} OSN items (deepest-first).`,
  );

  for (const target of targets) {
    // Only the top-level app gets entitlements; nested helpers + dylibs
    // inherit the main app's entitlements implicitly when loaded.
    sign(target, identity, false);
  }

  console.log('[sign-osn] Re-sealing top-level app bundle');
  sign(appPath, identity, true);

  console.log('[sign-osn] Verifying full bundle');
  try {
    execFileSync(
      'codesign',
      ['--verify', '--deep', '--strict', '--verbose=2', appPath],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    console.log('[sign-osn] OK');
  } catch (err) {
    console.error('[sign-osn] verify failed', err.message);
    throw err;
  }
};
