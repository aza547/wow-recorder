// Runtime stub for `noobs` on non-Windows builds.
// The platform factory lazy-requires the real noobs only on win32,
// but webpack + Electron UMD wrapper resolves externals at bundle
// load time regardless of whether code paths use them. This stub
// satisfies the `require('noobs')` call without shipping the real
// Windows-only native module.
module.exports = {};
module.exports.default = module.exports;
