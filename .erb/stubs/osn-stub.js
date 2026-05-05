// Runtime stub for `obs-studio-node` on non-macOS builds.
// The platform factory lazy-requires the real OSN only on darwin,
// but webpack + Electron UMD wrapper resolves externals at bundle
// load time regardless of whether code paths use them. This stub
// satisfies require('obs-studio-node') without shipping the real
// macOS-only build on Windows.
module.exports = {};
module.exports.default = module.exports;
