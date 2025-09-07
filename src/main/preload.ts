import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { ObsProperty, SceneItemPosition, SourceDimensions } from 'noobs';
import { AudioSourceType, WCRSceneItem } from './types';

export type Channels =
  | 'window'
  | 'getVideoState'
  | 'videoButton'
  | 'logPath'
  | 'openURL'
  | 'test'
  | 'getAllDisplays'
  | 'videoPlayerSettings'
  | 'recorder'
  | 'config'
  | 'getEncoders'
  | 'selectPath'
  | 'selectFile'
  | 'getNextKeyPress'
  | 'clip'
  | 'deleteVideos'
  | 'writeClipboard'
  | 'getShareableLink'
  | 'refreshFrontend'
  | 'doAppUpdate'
  | 'volmeter'
  | 'audioSettingsOpen'
  | 'audioSettingsClosed'
  | 'updateSourcePos'
  | 'createAudioSource'
  | 'getAudioSourceProperties'
  | 'deleteAudioSource'
  | 'setAudioSourceDevice'
  | 'setAudioSourceWindow'
  | 'getDisplayInfo'
  | 'configurePreview'
  | 'showPreview'
  | 'hidePreview'
  | 'disablePreview'
  | 'getSourcePosition'
  | 'setSourcePosition'
  | 'resetSourcePosition'
  | 'setForceMono'
  | 'setAudioSuppression'
  | 'setCaptureCursor'
  | 'reconfigureBase'
  | 'reconfigureVideo'
  | 'reconfigureOverlay'
  | 'reconfigureCloud';

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

    setSourcePosition(
      src: WCRSceneItem,
      target: { x: number; y: number; width: number; height: number },
    ) {
      ipcRenderer.send('setSourcePosition', src, target);
    },

    resetSourcePosition(src: WCRSceneItem) {
      ipcRenderer.send('resetSourcePosition', src);
    },

    audioSettingsOpen(): Promise<void> {
      return ipcRenderer.invoke('audioSettingsOpen');
    },

    audioSettingsClosed(): Promise<void> {
      return ipcRenderer.invoke('audioSettingsClosed');
    },

    // Also returns the properties.
    createAudioSource(id: string, type: AudioSourceType): Promise<string> {
      return ipcRenderer.invoke('createAudioSource', id, type);
    },

    getAudioSourceProperties(id: string): Promise<ObsProperty[]> {
      return ipcRenderer.invoke('getAudioSourceProperties', id);
    },

    deleteAudioSource(id: string): void {
      ipcRenderer.send('deleteAudioSource', id);
    },

    setAudioSourceDevice(id: string, device: string): void {
      ipcRenderer.send('setAudioSourceDevice', id, device);
    },

    setAudioSourceWindow(id: string, window: string): void {
      ipcRenderer.send('setAudioSourceWindow', id, window);
    },

    setAudioSourceVolume(id: string, volume: number): void {
      ipcRenderer.send('setAudioSourceVolume', id, volume);
    },

    setForceMono(enabled: boolean) {
      ipcRenderer.send('setForceMono', enabled);
    },

    setAudioSuppression(enabled: boolean) {
      ipcRenderer.send('setAudioSuppression', enabled);
    },

    reconfigureBase() {
      ipcRenderer.send('reconfigureBase');
    },

    reconfigureVideo() {
      ipcRenderer.send('reconfigureVideo');
    },

    reconfigureOverlay() {
      ipcRenderer.send('reconfigureOverlay');
    },

    reconfigureCloud() {
      ipcRenderer.send('reconfigureCloud');
    },
  },
});
