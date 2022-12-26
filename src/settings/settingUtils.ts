const ipc = window.electron.ipcRenderer;

const openDirectorySelectorDialog = (settingsKey: string) => {
  ipc.sendMessage('settingsWindow', ['openPathDialog', settingsKey]);
};

// eslint-disable-next-line import/prefer-default-export
export { openDirectorySelectorDialog };
