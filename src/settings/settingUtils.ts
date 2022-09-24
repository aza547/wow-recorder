const ipc = window.electron.ipcRenderer;

/**
 * These settings are saved when 'Update' is clicked.
 */
const stateKeyToSettingKeyMap = {
    'storagePath': 'storage-path',
    'bufferPath': 'buffer-path',
    'retailLogPath': 'retail-log-path',
    'classicLogPath': 'classic-log-path',
    'maxStorage': 'max-storage',
    'monitorIndex': 'monitor-index',
    'audioInputDevice': 'audio-input-device',
    'audioOutputDevice': 'audio-output-device',
    'minEncounterDuration': 'min-encounter-duration',
    'startUp': 'start-up',
};


type StateToSettingKeyMapKey = keyof typeof stateKeyToSettingKeyMap;

const openDirectorySelectorDialog = (settingsKey: string) => {
    ipc.sendMessage("settingsWindow", ["openPathDialog", settingsKey]);
}

export {
    stateKeyToSettingKeyMap,
    StateToSettingKeyMapKey,
    openDirectorySelectorDialog
};