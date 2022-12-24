const ipc = window.electron.ipcRenderer;

export const openDirectorySelectorDialog = (settingsKey: string) => {
  ipc.sendMessage('settingsWindow', ['openPathDialog', settingsKey]);
};
