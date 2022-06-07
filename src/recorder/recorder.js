const { PythonShell } = require('python-shell');
const { ipcRenderer } = require('electron');
const path = require('path');

const spawn = require("child_process").spawn;
var executablePath = "D:\\checkouts\\wow-recorder\\release\\app\\win64recorder\\ArenaRecorder.exe";


/**
 * Request config from the main process and store it off.
 */
async function getConfig(){
  const cfg = await ipcRenderer.invoke('GET-CFG', []);
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

  const process = spawn(executablePath, parameters, { shell: true });

  process.stdout.on('data', function (data) {
    const message = data.toString();
    console.log('stdout: ' + message);

    if (message.includes('RUNNING')) {
      ipcRenderer.send('setStatus', 0);
    } else if (message.includes('STARTED RECORDING')) {
      ipcRenderer.send('setStatus', 1);
    } else if (message.includes('STOPPED RECORDING')) {
      ipcRenderer.send('setStatus', 0);
    }
  });

  process.stderr.on('data', function (data) {
    console.log('stderr: ' + data.toString());
    ipcRenderer.send('setStatus', 2);
  });

  process.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  ipcRenderer.on('kill', () => {
    process.kill('SIGINT')
  });
}



/**
 * Call startRecording().
 */
 startRecording();




