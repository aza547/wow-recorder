const { PythonShell } = require('python-shell');
const { ipcRenderer } = require('electron');
const path = require('path');

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

  const options = {
    mode: 'text',
    pythonOptions: ['-u'], // get print results in real-time
    scriptPath: path.join(__dirname, '/../../python/'),
    args: ['--storage', `${cfg[0]}`,
           '--logs',    `${cfg[1]}`,
           '--size',    `${cfg[2]}`]
  };

  console.log('starting with args:\n' + `--storage ${cfg[0]}\n` + `--logs ${cfg[1]}\n` + `--size ${cfg[2]}`);
  let pyshell = new PythonShell("main.py", options);

  pyshell.on('message', function (message) {
    // handle message (a line of text from stdout)
    console.log(message);

    if (message.includes('RUNNING')) {
      ipcRenderer.send('setStatus', 0);
    } else if (message.includes('STARTED RECORDING')) {
      ipcRenderer.send('setStatus', 1);
    } else if (message.includes('STOPPED RECORDING')) {
      ipcRenderer.send('setStatus', 0);
    }
  });

  // we redirect stderr from ffmpeg to diags logs so it doesn't trigger this branch
  pyshell.on('stderr', function (message) {
    // handle message (a line of text from stderr)
    console.log(message);
    ipcRenderer.send('setStatus', 2);
  });
}

/**
 * Call startRecording().
 */
 startRecording();




