// Modified from https://github.com/stream-labs/streamlabs-obs/blob/staging/app/util/operating-systems.ts

const OS = {
    Windows: 'win32',
    Mac: 'darwin',
  }
  
  function byOS(handlers: any) {
    const handler = handlers[process.platform];
  
    if (typeof handler === 'function') return handler();
  
    return handler;
  }
  
  function getOS() {
    return process.platform
  }
  
  module.exports.OS = OS
  module.exports.byOS = byOS
  module.exports.getOS = getOS