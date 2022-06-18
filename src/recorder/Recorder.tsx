import * as React from 'react';

const executablePath = "D:\\checkouts\\wow-recorder\\release\\app\\win64recorder\\ArenaRecorder.exe";

export default function Layout() {

  /**
   * Request config from the main process and store it off.
   */
  async function getConfig(){
    const cfg = await window.electron.ipcRenderer.invoke('GET-CFG', []);
    console.log(cfg);
    return cfg;
  }

  /**
   * Start the recorder.
   */
  async function startRecording(){
    const cfg = await getConfig();

    var parameters = [
      '--storage', `\"${cfg[0]}\"`,
      '--logs',    `\"${cfg[1]}\"`,
      '--size',    `\"${cfg[2]}\"`];

    //const process = child_process.spawn(executablePath, parameters, { shell: true });

  //   process.stdout.on('data', function (data) {
  //     const message = data.toString();
  //     console.log('stdout: ' + message);

  //     if (message.includes('RUNNING')) {
  //       window.electron.ipcRenderer.send('setStatus', 0);
  //     } else if (message.includes('STARTED RECORDING')) {
  //       window.electron.ipcRenderer.send('setStatus', 1);
  //     } else if (message.includes('STOPPED RECORDING')) {
  //       window.electron.ipcRenderer.send('setStatus', 0);
  //     }
  //   });

  //   process.stderr.on('data', function (data) {
  //     console.log('stderr: ' + data.toString());
  //     window.electron.ipcRenderer.send('setStatus', 2);
  //   });

  //   process.on('close', (code) => {
  //     console.log(`child process exited with code ${code}`);
  //   });

  //   window.electron.ipcRenderer.on('kill', () => {
  //     process.kill('SIGINT')
  //   });
  }

  startRecording();

  return (
    <div>Abc</div>
  );
}
