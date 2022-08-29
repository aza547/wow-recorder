import recordIcon from '../../assets/icon/record-icon.png';
import eyeIcon from  '../../assets/icon/sleep-icon.png';
import errorIcon from  '../../assets/icon/error-icon.png';
import watchIcon from  '../../assets/icon/watch-icon.png';
<<<<<<< HEAD
import savingIcon from '../../assets/icon/saving-icon.png';
=======
>>>>>>> main
import * as React from 'react';

export default function Status() {

  /**
   * Recorder subprocess status.
   *   0 - waiting
   *   1 - recording
   *   2 - stopped/error
   *   3 - watching
   *   4 - saving
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
        <div id="status" title="Waiting for WoW to start">
          <img id="eye-icon" alt="icon" src={ eyeIcon }/>
        </div>
      )} else if (status === 1) {
        return(
          <div id="status">
            <img id="status-icon" title="Recording" alt="icon" src={ recordIcon }/>
          </div>
      )} else if (status === 2) {
        return(
          <div id="status">
            <img id="error-icon" title="Failed to launch, fix config and restart" alt="icon" src={ errorIcon }/>
          </div>
      )} else if (status === 3) {
        return(
          <div id="status">
            <img id="error-icon" title="Ready and waiting" alt="icon" src={ watchIcon }/>
          </div>
      )} else if (status === 4) {
        return(
          <div id="status">
            <img id="error-icon" title="Saving video" alt="icon" src={ savingIcon }/>
          </div>
      )} else {
        return(
          <div>Never reach here, but avoid linter error.</div>
      )}
    }

  return (
    getStatus()
  );
}

