import * as React from 'react';
import icon from '../../assets/icons8-heart-with-mouse-48.png';


export default function Settings() {

  /**
   * Save values. 
   */
   const saveSettings = () => {
    console.log("SAVE-SETTINGS event");

    const storagePath = document.getElementById("storage-path").getAttribute("value");
    const logPath = document.getElementById("log-path").getAttribute("value");
    const maxStorage = document.getElementById("max-storage").getAttribute("value");
    
    window.electron.ipcRenderer.sendMessage(
      'SAVE-SETTINGS', 
      [storagePath, logPath, maxStorage]
    );
  }

  const closeSettings = () => {
    console.log("QUIT event");
    window.electron.ipcRenderer.sendMessage('CLOSE-SETTINGS', []);
  }

  /**
   * Fill the placeholders with current config.
   */
  function populateSettings() {
    window.electron.ipcRenderer.sendMessage('GET-STORAGE-PATH', []);
    window.electron.ipcRenderer.sendMessage('GET-LOG-PATH', []);
    window.electron.ipcRenderer.sendMessage('GET-MAX-STORAGE', []);
  }

  window.electron.ipcRenderer.on('RESP-STORAGE-PATH', (path) => {
    document.getElementById("storage-path").setAttribute("placeholder", path);
  });
  
  window.electron.ipcRenderer.on('RESP-LOG-PATH', (path) => {
    document.getElementById("log-path").setAttribute("placeholder", path);
  });
  
  window.electron.ipcRenderer.on('RESP-MAX-STORAGE', (value) => {
    document.getElementById("max-storage").setAttribute("placeholder", value + "GB");
  });
  
  /**
   * Dialog window folder selection.
   */
  function setStoragePath() {
    window.electron.ipcRenderer.sendMessage("SET-STORAGE-PATH", "message");
  }

  window.electron.ipcRenderer.on('APPLY-STORAGE-PATH', (arg) => {
    document.getElementById("storage-path").setAttribute("value", arg);
  });

  function setLogPath() {
    window.electron.ipcRenderer.sendMessage("SET-LOG-PATH", "message");
  }

  window.electron.ipcRenderer.on('APPLY-LOG-PATH', (arg) => {
    document.getElementById("log-path").setAttribute("value", arg);
  });

  /**
   * Max storage text box event listener.
   */
  function setMaxStorage(event){
    document.getElementById("max-storage").setAttribute("value", event.value);
  }
  
  return (
    <div className="container">
      <div className="col-xl-9 col-lg-9 col-md-12 col-sm-12 col-12">
        <div className="card h-100">
          <div className="card-body">
            <div className="row gutters">
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Storage Path</label>
                  <input type="text" className="form-control" id="storage-path"/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Log Path</label>
                  <input type="text" className="form-control" id="log-path"/>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 col-12">
                <div className="form-group">
                  <label>Max Storage</label>
                  <input type="text" id="max-storage" className="form-control"/>
                </div>
              </div>
            </div>
            <div className="row gutters">
              <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                <div className="text-right">
                  <button type="button" id="close" name="close" className="btn btn-secondary" onClick={saveSettings}>Close</button>
                  <button type="button" id="submit" name="submit" className="btn btn-primary" onClick={closeSettings} >Update</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
  );
}
