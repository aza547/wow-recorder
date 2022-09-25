import * as React from 'react';

export function getConfigValue<T>(configKey: string): T {
  return (window.electron.ipcRenderer.sendSync('config', ['get', configKey]) as T);
};

export const setConfigValue = (configKey: string, value: any): void => {
  console.log("saving value to e-storage: ", configKey, value);
  window.electron.ipcRenderer.sendMessage('config', ['set', configKey, value]);
};

export default function useSettings() {
  const [config, setConfig] = React.useState({
    storagePath:          getConfigValue<string>('storagePath'),
    retailLogPath:        getConfigValue<string>('logPath'),
    classicLogPath:       getConfigValue<string>('logPathClassic'),
    maxStorage:           getConfigValue<number>('maxStorage'),
    minEncounterDuration: getConfigValue<number>('minEncounterDuration'),
    monitorIndex:         getConfigValue<number>('monitorIndex'),
    audioInputDevice:     getConfigValue<string>('audioInputDevice'),
    audioOutputDevice:    getConfigValue<string>('audioOutputDevice'),
    bufferPath:           getConfigValue<string>('bufferStoragePath'),
    startUp:              getConfigValue<boolean>('startUp'),
    tabIndex: 0,
    retail: true,
    classic: false,
    raids: true,
    dungeons: true,
    twoVTwo: true,
    threeVThree: true,
    skirmish: true,
    soloShuffle: true,
    battlegrounds: true,
  });

  return [config, setConfig];
};
