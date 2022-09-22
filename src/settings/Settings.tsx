import * as React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import ToggleButton from '@mui/material/ToggleButton';
import { ObsAudioDevice } from 'main/obsAudioDeviceUtils';
import InformationDialog from 'renderer/InformationDialog';

const ipc = window.electron.ipcRenderer;

export default function Settings() {

  const [dialogState, setDialog] = React.useState({
    open: false,
    dialogContent: '',
  });

  /**
   * React state variables.
   */
  const [state, useState] = React.useState({
    storagePath: window.electron.store.get('storage-path'),
    bufferStoragePath: window.electron.store.get('buffer-storage-path'),
    logPath: window.electron.store.get('log-path'),
    maxStorage: window.electron.store.get('max-storage'),
    monitorIndex: window.electron.store.get('monitor-index'),
    audioInputDevice: window.electron.store.get('audio-input-device'),
    audioOutputDevice: window.electron.store.get('audio-output-device'),
    minEncounterDuration: window.electron.store.get('min-encounter-duration'),
    startUp: window.electron.store.get('start-up') === 'true',
  });

  /**
   * These settings are saved when 'Update' is clicked.
   */
  const stateKeyToSettingKeyMap = {
    'storagePath': 'storage-path',
    'bufferStoragePath': 'buffer-storage-path',
    'logPath': 'log-path',
    'maxStorage': 'max-storage',
    'monitorIndex': 'monitor-index',
    'audioInputDevice': 'audio-input-device',
    'audioOutputDevice': 'audio-output-device',
    'minEncounterDuration': 'min-encounter-duration',
    'startUp': 'start-up',
  };
  type StateToSettingKeyMapKey = keyof typeof stateKeyToSettingKeyMap;

  /**
   * Close window.
   */
  const closeSettings = () => {
    ipc.sendMessage('settingsWindow', ['quit']);
  }

  /**
   * Save values. 
   */
  const saveSettings = () => {
    // Make sure that we can't select the same directory for both storagePath
    // and bufferStoragePath as that would cause the deletion of all videos
    // due to cleanupBuffer().
    if (state['storagePath'] === state['bufferStoragePath']) {
      openDialog((<span>Storage Path and Buffer Storage Path cannot be the same directory!</span>))
      return;
    }

    Object.values(stateKeyToSettingKeyMap).forEach(saveItem);

    ipc.sendMessage('settingsWindow', ['update']);
  }

  /**
   * Close window.
   */
  const saveItem = (setting: string) => {
    if (!document) return;
    const element = document.getElementById(setting); 
    if (!element) return;
    let value;

    if (setting === "start-up") {
      value = element.getAttribute("aria-pressed");
      ipc.sendMessage("settingsWindow", ["startup", value]);
    } else {
      value = element.getAttribute("value");
    }

    if (value) window.electron.store.set(setting, value);
  }
  
  /**
   * Open a diretory selector dialog for the given camelCase settings key
   */
  const openDirectorySelectorDialog = (settingsKey: string) => {
    ipc.sendMessage("settingsWindow", ["openPathDialog", settingsKey]);
  }

  /**
   * setSetting, why not just use react state hook?
   */
   const setSetting = (stateKey: StateToSettingKeyMapKey, value: any) => {
    const settingKey = stateKeyToSettingKeyMap[stateKey]
    const element = document.getElementById(settingKey)

    if (!element) {
      return;
    }

    console.log(`[SettingsWindow] Set setting '${settingKey}' to '${value}'`)
    element.setAttribute("value", value);

    useState((prevState) => ({...prevState, [stateKey]: value}))
  }

  const closeDialog = () => {
    setDialog(prev => {
      return {
        ...prev,
        open: false
      };
    });
  };

  const openDialog = (content: any) => {
    setDialog(prev => {
      return {
        ...prev,
        dialogContent: content,
        open: true,
      };
    });
  };

  /**
   * Event handler when user selects an option in dialog window.
   */
  React.useEffect(() => {
    ipc.on('settingsWindow', (args: any) => {
      if (args[0] === "pathSelected") setSetting(args[1], args[2]);
    });
  }, []);

  const audioDevices = ipc.sendSync('getAudioDevices', []);
  const availableAudioDevices = {
    input: [
      new ObsAudioDevice('none', '(None: no microphone input will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.input,
    ],
    output: [
      new ObsAudioDevice('none', '(None: no sound will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.output,
    ]
  };

  const bufferStoragePathPlaceholder = state.bufferStoragePath ? state.bufferStoragePath : "(Default)";

  return (
    <div className="container">
      <InformationDialog
        title='Invalid Configuration'
        open={dialogState.open}
        buttons={['ok']}
        onClose={closeDialog}
      >
        {dialogState.dialogContent}
      </InformationDialog>

      <div className="col-xl-9 col-lg-9 col-md-12 col-sm-12 col-12">
        <div className="card h-100">
          <div className="card-body">
            <div className="row gutters">
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Storage Path </label>
                  <input type="text" className="form-control" id="storage-path" placeholder={state.storagePath} onClick={() => openDirectorySelectorDialog('storagePath')}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Buffer Storage Path </label>
                  <input type="text" className="form-control" id="buffer-storage-path" placeholder={bufferStoragePathPlaceholder} onClick={() => openDirectorySelectorDialog('bufferStoragePath')}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Log Path </label>
                  <input type="text" className="form-control" id="log-path" placeholder={state.logPath} onClick={() => openDirectorySelectorDialog('logPath')}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Max Storage (GB) </label>
                  <input type="text" id="max-storage" className="form-control" placeholder={state.maxStorage} onChange={(event) => setSetting('maxStorage', event.target.value)}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Monitor Number </label>
                  <input type="text" id="monitor-index" className="form-control" placeholder={state.monitorIndex} onChange={(event) => setSetting('monitorIndex', event.target.value)}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Record audio input from </label>
                  <select id="audio-input-device" className="form-control" value={state.audioInputDevice} onChange={(event) => setSetting('audioInputDevice', event.target.value)}>
                    { availableAudioDevices.input.map((device: ObsAudioDevice) => {
                      return (
                        <option key={ 'device_' + device.id } value={ device.id }>{ device.name }</option>
                      )
                    })}
                  </select>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Min Encounter Duration (sec) </label>
                  <input type="text" id="min-encounter-duration" className="form-control" placeholder={state.minEncounterDuration} onChange={(event) => setSetting('minEncounterDuration', event.target.value)}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Record audio output from </label>
                  <select id="audio-output-device" className="form-control" value={state.audioOutputDevice} onChange={(event) => setSetting('audioOutputDevice', event.target.value)}>
                    { availableAudioDevices.output.map((device: ObsAudioDevice) => {
                      return (
                        <option key={ 'device_' + device.id } value={ device.id }>{ device.name }</option>
                      )
                    })}
                  </select>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Run on Startup? </label>
                  <ToggleButton
                    id="start-up"
                    size="small"
                    sx={{ border: '1px solid #bcd0f7', width: 25, height: 25, margin: 1 }}
                    value="check"
                    selected={ state.startUp }
                    onChange={ () => setSetting('startUp', !state.startUp) }
                  >
                  { state.startUp &&
                    <CheckIcon sx={{ color: '#bcd0f7' }}/>
                  }                    
                  </ToggleButton>
                </div>
              </div>
            </div>
            <div className="row gutters">
              <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                <div className="text-center">
                  <button type="button" id="close" name="close" className="btn btn-secondary" onClick={closeSettings}>Close</button>
                  <button type="button" id="submit" name="submit" className="btn btn-primary" onClick={saveSettings}>Update</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
  );
}
