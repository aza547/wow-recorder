import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'mainWindow' | 'settingsWindow';

contextBridge.exposeInMainWorld('electron', {
  store: {
    get(val: any) {
      return ipcRenderer.sendSync('cfg-get', val);
    },

    set(property: any, val: any) {
      ipcRenderer.send('cfg-set', property, val);
    },
  },
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },

    sendSync(channel: Channels, args: unknown[]) {
      return ipcRenderer.sendSync(channel, args);
    },

    invoke(channel: Channels, args: unknown[]) {
      return ipcRenderer.invoke(channel, args);
    },

    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => ipcRenderer.removeListener(channel, subscription);
    },

    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
});