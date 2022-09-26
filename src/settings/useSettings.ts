import * as React from 'react';

export function getConfigValue<T>(configKey: string): T {
  return (window.electron.ipcRenderer.sendSync('config', ['get', configKey]) as T);
};

export function setConfigValue(configKey: string, value: any): void {
  console.log("saving value to e-storage: ", configKey, value);
  window.electron.ipcRenderer.sendMessage('config', ['set', configKey, value]);
};

export const configSettings = [
  'storagePath',
  'retailLogPath',
  'classicLogPath',
  'maxStorage',
  'minEncounterDuration',
  'monitorIndex',
  'audioInputDevice',
  'audioOutputDevice',
  'bufferStoragePath',
  'startUp',
  'recordRetail',
  'recordClassic',
  'recordRaids',
  'recordDungeons',
  'recordTwoVTwo',
  'recordThreeVThree',
  'recordSkirmish',
  'recordSoloShuffle',
  'recordBattlegrounds',
];

export default function useSettings() {
  const [config, setConfig] = React.useState({
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
    recordRetail:         getConfigValue<boolean>('recordRetail'),
    recordClassic:        getConfigValue<boolean>('recordClassic'),
    recordRaids:          getConfigValue<boolean>('recordRaids'),
    recordDungeons:       getConfigValue<boolean>('recordDungeons'),
    recordTwoVTwo:        getConfigValue<boolean>('recordTwoVTwo'),
    recordThreeVThree:    getConfigValue<boolean>('recordThreeVThree'),
    recordSkirmish:       getConfigValue<boolean>('recordSkirmish'),
    recordSoloShuffle:    getConfigValue<boolean>('recordSoloShuffle'),
    recordBattlegrounds:  getConfigValue<boolean>('recordBattlegrounds'),
  });

  return [config, setConfig];
};
