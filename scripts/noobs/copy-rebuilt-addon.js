/* eslint-env node */
/* global require, __dirname, process, module */

const fs = require('fs');
const path = require('path');

const copyRebuiltNoobsAddon = (noobsPackagePath) => {
  const packagePath =
    noobsPackagePath ||
    path.join(__dirname, '..', '..', 'release', 'app', 'node_modules', 'noobs');

  const rebuiltAddon = path.join(packagePath, 'build', 'Release', 'noobs.node');
  const distAddon = path.join(packagePath, 'dist', 'noobs.node');

  if (!fs.existsSync(rebuiltAddon)) {
    throw new Error(`rebuilt noobs addon not found: ${rebuiltAddon}`);
  }

  fs.mkdirSync(path.dirname(distAddon), { recursive: true });
  fs.copyFileSync(rebuiltAddon, distAddon);
  fs.chmodSync(distAddon, 0o755);

  console.log(`[noobs] Copied rebuilt addon to ${distAddon}`);
};

module.exports = copyRebuiltNoobsAddon;

if (require.main === module) {
  try {
    copyRebuiltNoobsAddon(process.argv[2]);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
