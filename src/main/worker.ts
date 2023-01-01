const { parentPort } = require('worker_threads');
const { NodeObs } = require('obs-studio-node');
const path = require('node:path');

const fixPathWhenPackaged = (pathSpec) => {
  return pathSpec.replace('app.asar', 'app.asar.unpacked');
};

// Receive message from the parent
parentPort.on('message', (action) => {
  console.log("abcdefa");
  if (action === 'init') {
    try {
      NodeObs.IPC.host("abcdfef");

      NodeObs.SetWorkingDirectory(
        fixPathWhenPackaged(
          path.join(__dirname, '../../', 'node_modules', 'obs-studio-node')
        )
      );

      const initResult = NodeObs.OBS_API_initAPI(
        'en-US',
        fixPathWhenPackaged(path.join(path.normalize(__dirname), 'osn-data')),
        '1.0.0',
        ''
      );

      if (initResult !== 0) {
        throw new Error(
          `OBS process initialization failed with code ${initResult}`
        );
      }
    } catch (e) {
      throw new Error(`Exception when initializing OBS process: ${e}`);
    }
  }
  parentPort.postMessage('done');
});
