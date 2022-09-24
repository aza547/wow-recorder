const ipc = window.electron.ipcRenderer;

/**
 * setSetting, why not just use react state hook?
 */
const setSetting = (stateKey: StateToSettingKeyMapKey, 
                    value: any, setState: 
                    React.Dispatch<React.SetStateAction<any>>) => {
    const settingKey = stateKeyToSettingKeyMap[stateKey]
    const element = document.getElementById(settingKey)
    if (!element) return;
    console.log(`[SettingsWindow] Set setting '${settingKey}' to '${value}'`)
    element.setAttribute("value", value);
    setState((prevState: any) => ({...prevState, [stateKey]: value}))
}

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
    openDirectorySelectorDialog,
    setSetting
};