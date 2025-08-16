import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { SceneItemPosition, SourceDimensions } from 'noobs';
import { VideoSourceName, WCRSceneItem } from './types';

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
  | 'getDisplayInfo'
  | 'configurePreview'
  | 'showPreview'
  | 'hidePreview'
  | 'disablePreview'
  | 'getSourcePosition'
  | 'setSourcePosition'
  | 'resetSourcePosition';

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

    getDisplayInfo(): Promise<{
      canvasWidth: number;
      canvasHeight: number;
      previewWidth: number;
      previewHeight: number;
    }> {
      return ipcRenderer.invoke('getDisplayInfo');
    },

    // This is async as it's useful to wait for the configuration to complete
    // before triggering frontend updates.
    configurePreview(x: number, y: number, width: number, height: number) {
      ipcRenderer.send('configurePreview', x, y, width, height);
    },

    showPreview() {
      ipcRenderer.send('showPreview');
    },

    hidePreview() {
      ipcRenderer.send('hidePreview');
    },

    disablePreview() {
      ipcRenderer.send('disablePreview');
    },

    getSourcePosition(
      src: WCRSceneItem,
    ): Promise<SourceDimensions & SceneItemPosition> {
      return ipcRenderer.invoke('getSourcePosition', src);
    },

    setSourcePosition(src: WCRSceneItem, target: { x: number; y: number; width: number; height: number }) {
      ipcRenderer.send('setSourcePosition', src, target);
    },

    resetSourcePosition(src: WCRSceneItem) {
      ipcRenderer.send('resetSourcePosition', src);
    },
  },
});
