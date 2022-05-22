/**
 * Clickable buttons.
 */
function saveSettings(){
  console.log("SAVE-SETTINGS event");

  const storagePath = document
  .getElementById("storage-path")
  .getAttribute("text");

  const logPath = document
  .getElementById("log-path")
  .getAttribute("text");

  const maxStorage = document
  .getElementById("max-storage")
  .getAttribute("text");

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

window.electron.ipcRenderer.on('RESP-STORAGE-PATH', (arg) => {
  document
  .getElementById("storage-path")
  .setAttribute("placeholder", arg);
});

window.electron.ipcRenderer.on('RESP-LOG-PATH', (arg) => {
  document
  .getElementById("log-path")
  .setAttribute("placeholder", arg);
});

window.electron.ipcRenderer.on('RESP-MAX-STORAGE', (arg) => {
  document
  .getElementById("max-storage")
  .setAttribute("placeholder", arg + "GB");
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
