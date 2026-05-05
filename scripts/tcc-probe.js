// Standalone TCC probe.
// Run via Electron directly (NOT through npm/electronmon) to test
// if responsible-process chain affects the result:
//
//   ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron \
//     scripts/tcc-probe.js
//
// vs. our normal:
//
//   npm start
//
// Both should print the same getMediaAccessStatus output if TCC is
// healthy. If they differ, the npm chain is breaking responsible-proc
// inheritance and TCC is consulting the parent (Node/Terminal) instead.

const { app, systemPreferences } = require('electron');

app.whenReady().then(() => {
  const screen = systemPreferences.getMediaAccessStatus('screen');
  const mic = systemPreferences.getMediaAccessStatus('microphone');
  const accessibility = systemPreferences.isTrustedAccessibilityClient(false);

  console.log('---');
  console.log('process.pid     =', process.pid);
  console.log('process.argv0   =', process.argv0);
  console.log('process.execPath=', process.execPath);
  console.log('screen          =', screen);
  console.log('microphone      =', mic);
  console.log('accessibility   =', accessibility ? 'granted' : 'denied');
  console.log('---');
  app.quit();
});
