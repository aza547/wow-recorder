import * as React from 'react';
import icon from '../../assets/icons8-heart-with-mouse-48.png';


export default function Settings() {

  const [storagePath, setStoragePath] = React.useState();
  const [logPath, setLogPath] = React.useState();
  const [maxStorage, setMaxStorage] = React.useState();

  /**
   * Save values. 
   */
   const saveSettings = () => {
    console.log("SAVE-SETTINGS event");
    
    window.electron.ipcRenderer.sendMessage(
      'SAVE-SETTINGS', [ 
        document.getElementById("storage-path").getAttribute("value"), 
        document.getElementById("log-path").getAttribute("value"), 
        document.getElementById("max-storage").getAttribute("value")
      ]
    );
  }

  const closeSettings = () => {
    console.log("QUIT event");
    window.electron.ipcRenderer.sendMessage('CLOSE-I-SETTINGS', []);
  }

  /**
   * Fill the placeholders with current config.
   */
   const populateSettings = () => {
    window.electron.ipcRenderer.sendMessage('GET-STORAGE-PATH', []);
    window.electron.ipcRenderer.sendMessage('GET-LOG-PATH', []);
    window.electron.ipcRenderer.sendMessage('GET-MAX-STORAGE', []);
  }

  window.electron.ipcRenderer.on('RESP-STORAGE-PATH', (path) => {
    setStoragePath(path);
  });
  
  window.electron.ipcRenderer.on('RESP-LOG-PATH', (path) => {
    setLogPath(path);
  });
  
  window.electron.ipcRenderer.on('RESP-MAX-STORAGE', (value) => {
   setMaxStorage(value);
  });
  
  /**
   * Dialog window folder selection.
   */
  const setCfgStoragePath = () => {
    window.electron.ipcRenderer.sendMessage("SET-STORAGE-PATH", "message");
  }

  window.electron.ipcRenderer.on('APPLY-STORAGE-PATH', (arg) => {
    document.getElementById("storage-path").setAttribute("value", arg); 
  });

  const setCfgLogPath = () => {
    window.electron.ipcRenderer.sendMessage("SET-LOG-PATH", "message");
  }

  window.electron.ipcRenderer.on('APPLY-LOG-PATH', (arg) => {
    document.getElementById("log-path").setAttribute("value", arg);
  });

  const updateMaxStorageValue = (event) => {
    document.getElementById("max-storage").setAttribute("value", event.target.value);
  }

  populateSettings();
  
  return (
    <div className="container">
      <div className="col-xl-9 col-lg-9 col-md-12 col-sm-12 col-12">
        <div className="card h-100">
          <div className="card-body">
            <div className="row gutters">
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Storage Path</label>
                  <input type="text" className="form-control" id="storage-path" placeholder={storagePath} onClick={setCfgStoragePath}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Log Path</label>
                  <input type="text" className="form-control" id="log-path" placeholder={logPath} onClick={setCfgLogPath}/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Max Storage (GB)</label>
                  <input type="text" id="max-storage" className="form-control" placeholder={maxStorage} onChange={(event) => updateMaxStorageValue(event)}/>
                </div>
              </div>
            </div>
            <div className="row gutters">
              <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                <div className="text-right">
                  <button type="button" id="close" name="close" className="btn btn-secondary" onClick={closeSettings}>Close</button>
                  <button type="button" id="submit" name="submit" className="btn btn-primary" onClick={saveSettings} >Update</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
  );
}
