import * as React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import ToggleButton from '@mui/material/ToggleButton';
import { ObsAudioDevice } from 'main/obsAudioDeviceUtils';

const ipc = window.electron.ipcRenderer;

export default function Settings() {

  /**
   * React state variables.
   */
  const [storagePath] = React.useState(window.electron.store.get('storage-path'));
  const [logPath] = React.useState(window.electron.store.get('log-path'));
  const [maxStorage] = React.useState(window.electron.store.get('max-storage'));
  const [monitorIndex] = React.useState(window.electron.store.get('monitor-index'));
  const [audioInputDevice] = React.useState(window.electron.store.get('audio-input-device', 'all'));
  const [audioOutputDevice] = React.useState(window.electron.store.get('audio-output-device', 'all'));

  /**
   * These settings are saved when 'Update' is clicked.
   */
  const settingsToSave = [
    'storage-path',
    'log-path',
    'max-storage',
    'start-up',
    'monitor-index',
    'audio-input-device',
    'audio-output-device',
  ];

  const [startUp, setStartUp] = React.useState(() => {
    return (window.electron.store.get('start-up') === 'true');
  });

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
    settingsToSave.forEach(saveItem);

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
   * Dialog window folder selection.
   */
  const openStoragePathDialog = () => {
    ipc.sendMessage("settingsWindow", ["openPathDialog", "storage-path"]);
  }

  const openLogPathDialog = () => {
    ipc.sendMessage("settingsWindow", ["openPathDialog", "log-path"]);
  }

  /**
   * Event handler when user types a new value for max storage.
   */
  const updateMaxStorageValue = (event: any) => {
    const maxStorageElement = document.getElementById("max-storage");
    if (maxStorageElement) maxStorageElement.setAttribute("value", event.target.value);
  }

  /**
   * Event handler when user types a new value for max storage.
   */
  const updateMonitorIndexValue = (event: any) => {
    const monitorIndexElement = document.getElementById("monitor-index");
    if (monitorIndexElement) monitorIndexElement.setAttribute("value", event.target.value);
  }

  /**
   * Event handler when user selects a new audio device
   */
  const updateAudioDeviceValue = (event: any, category: string) => {
    document.getElementById("audio-" + category + "-device")?.setAttribute("value", event.target.value);
  }

  /**
   * setSetting, why not just use react state hook?
   */
   const setSetting = (args: any) => {
    const setting = args[1];
    const value = args[2];
    const element = document.getElementById(setting);
    if (element) element.setAttribute("value", value);
  }

  /**
   * Event handler when user selects an option in dialog window.
   */
  React.useEffect(() => {
    ipc.on('settingsWindow', (args: any) => {
      if (args[0] === "pathSelected") setSetting(args);
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
      new ObsAudioDevice('none', 'None: no sound will be recorded'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.output,
    ]
  };

  return (
    <div className="container">
      <div className="col-xl-9 col-lg-9 col-md-12 col-sm-12 col-12">
        <div className="card h-100">
          <div className="card-body">
            <div className="row gutters">
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Storage Path </label>
                  <input type="text" className="form-control" id="storage-path" placeholder={storagePath} onClick={openStoragePathDialog}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Log Path </label>
                  <input type="text" className="form-control" id="log-path" placeholder={logPath} onClick={openLogPathDialog}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Max Storage (GB) </label>
                  <input type="text" id="max-storage" className="form-control" placeholder={maxStorage} onChange={(event) => updateMaxStorageValue(event)}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Monitor Number </label>
                  <input type="text" id="monitor-index" className="form-control" placeholder={monitorIndex} onChange={(event) => updateMonitorIndexValue(event)}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Record audio input from </label>
                  <select id="audio-input-device" className="form-control" onChange={(event) => updateAudioDeviceValue(event, 'input')}>
                    { availableAudioDevices.input.map((device: ObsAudioDevice) => {
                      return (
                        <option value={ device.id } selected={ audioInputDevice == device.id }>{ device.name }</option>
                      )
                    })}
                  </select>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label> Record audio output from </label>
                  <select id="audio-output-device" className="form-control" onChange={(event) => updateAudioDeviceValue(event, 'output')}>
                    { availableAudioDevices.output.map((device: ObsAudioDevice) => {
                      return (
                        <option value={ device.id } selected={ audioOutputDevice == device.id }>{ device.name }</option>
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
                    selected={ startUp }
                    onChange={ () => setStartUp(!startUp) }
                  >
                  { startUp &&
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
