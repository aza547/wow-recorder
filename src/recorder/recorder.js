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
 * Start the recorder. This is thread blocking.
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
  });
}

/**
 * Call startRecording().
 */
 startRecording();




