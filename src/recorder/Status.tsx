import recordIcon from '../../assets/record.png';
import eyeIcon from  '../../assets/icons8-sleep-50.png';
import errorIcon from  '../../assets/icons8-error-16.png';
import * as React from 'react';

export default function Status() {

  /**
   * Python subprocess status.
   *   0 - waiting
   *   1 - recording
   *   2 - stopped/error
   */
  const [status, setStatus] = React.useState(0);

  /**
   * Update status handler.
   */
  window.electron.ipcRenderer.on('updateStatus', (status) => {
    setStatus(status);
  });

  /**
   * Get the status, either watching, recording, or error.
   */
  function getStatus() {
    if (status === 0) {
      return(
        <div id="status" title="Waiting for a game to start...">
          <img id="eye-icon" alt="icon" src={eyeIcon}/>
        </div>
      )} else if (status === 1) {
        return(
          <div id="status">
            <img id="status-icon" title="Recording a game!" alt="icon" src={recordIcon}/>
          </div>
      )} else if (status === 2) {
        return(
          <div id="status">
            <img id="error-icon" title="Python screen recorder hit an error." alt="icon" src={errorIcon}/>
          </div>
      )}
    }

  return (
    getStatus()
  );
}

