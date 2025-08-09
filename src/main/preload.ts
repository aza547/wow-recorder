import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { SceneItemPosition, SourceDimensions } from 'noobs';

export type Channels =
  | 'mainWindow'
  | 'getVideoState'
  | 'videoButton'
  | 'logPath'
  | 'openURL'
  | 'test'
  | 'getAudioDevices'
  | 'getAllDisplays'
  | 'videoPlayerSettings'
  | 'recorder'
  | 'config'
  | 'preview'
  | 'getEncoders'
  | 'selectPath'
  | 'selectFile'
  | 'settingsChange'
  | 'getNextKeyPress'
  | 'clip'
  | 'deleteVideos'
  | 'writeClipboard'
  | 'getShareableLink'
  | 'refreshFrontend'
  | 'doAppUpdate'
  | 'volmeter'
  | 'audioSettingsOpen'
  | 'updateSourcePos'
  | 'createAudioSource'
  | 'getPreviewDimensions'
  | 'getSourcePosition'
  | 'setSourcePosition';

contextBridge.exposeInMainWorld('electron', {
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

    removeAllListeners(channel: Channels) {
      ipcRenderer.removeAllListeners(channel);
    },

    getPreviewInfo(): Promise<{
      canvasWidth: number;
      canvasHeight: number;
      previewWidth: number;
      previewHeight: number;
    }> {
      return ipcRenderer.invoke('getPreviewInfo');
    },

    getSourcePosition(
      src: string,
    ): Promise<SourceDimensions & SceneItemPosition> {
      return ipcRenderer.invoke('getSourcePosition', src);
    },

    setSourcePosition(src: string, position: SceneItemPosition) {
      ipcRenderer.send('setSourcePosition', src, position);
    },
  },
});
