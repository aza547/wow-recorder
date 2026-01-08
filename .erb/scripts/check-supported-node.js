const major = Number.parseInt(process.versions.node.split('.')[0], 10);

// electron-builder spawns npm and parses JSON output from it. On newer Node
// versions we have seen npm/node child-process stdout not being captured
// reliably, causing packaging to fail with "Unexpected end of JSON input".
//
// Keep this conservative: allow current LTS majors by default.
const supportedMajors = new Set([20, 22]);

if (process.env.ALLOW_UNSUPPORTED_NODE === '1') {
  process.stderr.write(
    `[check-supported-node] Skipping node version check (ALLOW_UNSUPPORTED_NODE=1). Detected Node ${process.versions.node}\n`,
  );
  process.exit(0);
}

if (!supportedMajors.has(major)) {
  process.stderr.write(
    `[check-supported-node] Unsupported Node version for packaging: ${process.versions.node}\n` +
      `[check-supported-node] Use Node 22 LTS (recommended) or Node 20 LTS, then re-run the package command.\n` +
      `[check-supported-node] If you want to try anyway, re-run with ALLOW_UNSUPPORTED_NODE=1.\n`,
  );
  process.exit(1);
}

