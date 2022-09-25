import * as React from 'react';

const store = window.electron.store;

export default function useSettings() {
  const [config, setConfig] = React.useState({
    tabIndex: 0,
    storagePath: store.get('storage-path'),
    retailLogPath: store.get('retail-log-path'),
    classicLogPath: store.get('classic-log-path'),
    maxStorage: store.get('max-storage'),
    retail: true,
    classic: false,
    raids: true,
    dungeons: true,
    twoVTwo: true,
    threeVThree: true,
    skirmish: true,
    soloShuffle: true,
    battlegrounds: true,
    monitorIndex: 1,
    audioInputDevice: store.get('audio-input-device'),
    audioOutputDevice: store.get('audio-output-device'),
    bufferPath: store.get('buffer-storage-path'),
  });

  return [config, setConfig];
}
