import recordIcon from '../../assets/icon/record-icon.png';
import eyeIcon from  '../../assets/icon/sleep-icon.png';
import errorIcon from  '../../assets/icon/error-icon.png';
import watchIcon from  '../../assets/icon/watch-icon.png';
import savingIcon from '../../assets/icon/saving-icon.png';
import { useState, useEffect } from 'react';
import { AppStatus } from 'main/types';

type StatusMessageType = 'error' | 'status';

type StatusMessageObjectType = {
  title: string,
  type: StatusMessageType,
  icon: string,
};

const statusMessages: { [key: number]: StatusMessageObjectType } = {
  [AppStatus.WaitingForWoW]: { type: 'status', icon: eyeIcon, title: 'Waiting for WoW to start' },
  [AppStatus.Recording]:     { type: 'status', icon: recordIcon, title: 'Recording' },
  [AppStatus.InvalidConfig]: { type: 'error', icon: errorIcon, title: 'Failed to launch, check config is valid' },
  [AppStatus.ReadyToRecord]: { type: 'status', icon: watchIcon, title: 'Ready and waiting'},
  [AppStatus.SavingVideo]:   { type: 'status', icon: savingIcon, title: 'Saving video' },
};

export default function Status() {

  const [status, setStatus] = useState(AppStatus.WaitingForWoW);

  /**
   * Update status handler.
   */
   useEffect(() => {
    window.electron.ipcRenderer.on('updateStatus', (status) => {
      setStatus(status as AppStatus);
    });
  }, []);

  const message = statusMessages[status];

  return (
    <div id="status">
      <img id={ message.type + '-icon' } title={ message.title } alt="icon" src={ message.icon }/>
    </div>
  );
}
