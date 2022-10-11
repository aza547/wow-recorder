import * as React from 'react';

export function getConfigValue<T>(configKey: string): T {
  return (window.electron.ipcRenderer.sendSync('config', ['get', configKey]) as T);
};

export function setConfigValue(configKey: string, value: any): void {
  window.electron.ipcRenderer.sendMessage('config', ['set', configKey, value]);
};

export function setConfigValues(dict: { [key: string]: any }): void {
  window.electron.ipcRenderer.sendMessage('config', ['set_values', dict]);
};

const configValues = {
  storagePath:          getConfigValue<string>('storagePath'),
  bufferStoragePath:    getConfigValue<string>('bufferStoragePath'),
  retailLogPath:        getConfigValue<string>('retailLogPath'),
  classicLogPath:       getConfigValue<string>('classicLogPath'),
  maxStorage:           getConfigValue<number>('maxStorage'),
  minEncounterDuration: getConfigValue<number>('minEncounterDuration'),
  monitorIndex:         getConfigValue<number>('monitorIndex'),
  audioInputDevice:     getConfigValue<string>('audioInputDevice'),
  audioOutputDevice:    getConfigValue<string>('audioOutputDevice'),
  startUp:              getConfigValue<boolean>('startUp'),
  startMinimized:       getConfigValue<boolean>('startMinimized'),
  recordRetail:         getConfigValue<boolean>('recordRetail'),
  recordClassic:        getConfigValue<boolean>('recordClassic'),
  recordRaids:          getConfigValue<boolean>('recordRaids'),
  recordDungeons:       getConfigValue<boolean>('recordDungeons'),
  recordTwoVTwo:        getConfigValue<boolean>('recordTwoVTwo'),
  recordThreeVThree:    getConfigValue<boolean>('recordThreeVThree'),
  recordSkirmish:       getConfigValue<boolean>('recordSkirmish'),
  recordSoloShuffle:    getConfigValue<boolean>('recordSoloShuffle'),
  recordBattlegrounds:  getConfigValue<boolean>('recordBattlegrounds'),
  obsBaseResolution:    getConfigValue<string>('obsBaseResolution'),
  obsOutputResolution:  getConfigValue<string>('obsOutputResolution'),
  obsFPS:               getConfigValue<number>('obsFPS'),
  obsKBitRate:          getConfigValue<number>('obsKBitRate'),
};

export default function useSettings() {
  const [config, setConfig] = React.useState(configValues);

  return [config, setConfig];
};
