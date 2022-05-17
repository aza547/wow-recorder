function saveSettings(){
  console.log("SAVE-SETTINGS event");
  window.electron.ipcRenderer.sendMessage('SAVE-SETTINGS', ['ping']);
}

function closeSettings(){
  console.log("CLOSE-SETTINGS event");
  window.electron.ipcRenderer.sendMessage('CLOSE-SETTINGS', ['ping']);
}
