const { PythonShell } = require('python-shell');
const { ipcRenderer } = require('electron');
const path = require('path');

const pythonRecorderPath = path.join(__dirname, '/../../python/main.py')

const options = {
  mode: 'text',
  pythonOptions: ['-u'], // get print results in real-time
  scriptPath: path.join(__dirname, '/../../python/'),
  args: ['--storage', 'D:\\wow-recorder-files',
         '--logs', 'D:\\World of Warcraft\\_retail_\\Logs',
         '--size', '50']
};

PythonShell.run("main.py", options, function (err, results) {
  console.log('started');
  if (err) throw err;
  console.log('finished');
});
