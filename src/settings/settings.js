/**
 * Clickable buttons.
 */
function saveSettings(){
  console.log("SAVE-SETTINGS event");

  const storagePath = document
  .getElementById("storage-path")
  .getAttribute("value");

  const logPath = document
  .getElementById("log-path")
  .getAttribute("value");

  const maxStorage = document
  .getElementById("max-storage")
  .getAttribute("value");

  window.electron.ipcRenderer
  .sendMessage('SAVE-SETTINGS', [storagePath, logPath, maxStorage]);
}

function closeSettings(){
  window.electron.ipcRenderer
  .sendMessage('CLOSE-SETTINGS');
}

/**
 * Fill the placeholders with current config.
 */
function populateSettings() {
  window.electron.ipcRenderer
  .sendMessage('GET-STORAGE-PATH');

  window.electron.ipcRenderer
  .sendMessage('GET-LOG-PATH');

  window.electron.ipcRenderer
  .sendMessage('GET-MAX-STORAGE');
}

window.electron.ipcRenderer.on('RESP-STORAGE-PATH', (path) => {
  document
  .getElementById("storage-path")
  .setAttribute("placeholder", path);
});

window.electron.ipcRenderer.on('RESP-LOG-PATH', (path) => {
  document
  .getElementById("log-path")
  .setAttribute("placeholder", path);
});

window.electron.ipcRenderer.on('RESP-MAX-STORAGE', (value) => {
  document
  .getElementById("max-storage")
  .setAttribute("placeholder", value + "GB");
});

/**
 * Dialog window folder selection.
 */
function setStoragePath() {
  window.electron.ipcRenderer.sendMessage("SET-STORAGE-PATH", "message");
}

window.electron.ipcRenderer.on('APPLY-STORAGE-PATH', (arg) => {
  document
  .getElementById("storage-path")
  .setAttribute("value", arg);
});

function setLogPath() {
  window.electron.ipcRenderer.sendMessage("SET-LOG-PATH", "message");
}

window.electron.ipcRenderer.on('APPLY-LOG-PATH', (arg) => {
  document
  .getElementById("log-path")
  .setAttribute("value", arg);
});

/**
 * Max storage text box event listener.
 */
function setMaxStorage(event){
  document
  .getElementById("max-storage")
  .setAttribute("value", event.value);
}



