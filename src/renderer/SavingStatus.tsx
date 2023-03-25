import { useState, useEffect } from 'react';
import { SaveStatus } from 'main/types';
import savingIcon from '../../assets/icon/saving-icon.png';

export default function SavingStatus() {
  const [status, setStatus] = useState(SaveStatus.NotSaving);

  useEffect(() => {
    window.electron.ipcRenderer.on('updateSaveStatus', (newSaveStatus) => {
      setStatus(newSaveStatus as SaveStatus);
    });
  }, []);

  return (
    <div id="saving-button-div">
      <button
        id="rec-status-button"
        type="button"
        // onClick={openDiscordURL}
        title="Status"
      >
        <img alt="icon" src={savingIcon} height="25px" width="25px" />
      </button>
    </div>
  );
}
