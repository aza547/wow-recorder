import recordIcon from '../../assets/icon/record-icon.png';
import eyeIcon from  '../../assets/icon/sleep-icon.png';
import errorIcon from  '../../assets/icon/error-icon.png';
import watchIcon from  '../../assets/icon/watch-icon.png';
import savingIcon from '../../assets/icon/saving-icon.png';
import stopRecordingIcon from '../../assets/icon/stop-recording.png';
import { useState, useEffect } from 'react';
import { AppStatus } from 'main/types';
import InformationDialog from './InformationDialog';

const ipc = window.electron.ipcRenderer;

type IconStyle = 'small' | 'big';

type StatusMessageObjectType = {
  title: string,
  style: IconStyle,
  icon: string,
};

const statusMessages: { [key: number]: StatusMessageObjectType } = {
  [AppStatus.WaitingForWoW]: { style: 'small', icon: eyeIcon,    title: 'Waiting for WoW to start' },
  [AppStatus.Recording]:     { style: 'big',   icon: recordIcon, title: 'Recording' },
  [AppStatus.InvalidConfig]: { style: 'small', icon: errorIcon,  title: 'Failed to launch, check config is valid' },
  [AppStatus.ReadyToRecord]: { style: 'small', icon: watchIcon,  title: 'Ready and waiting'},
  [AppStatus.SavingVideo]:   { style: 'small', icon: savingIcon, title: 'Saving video' },
};

export default function Status() {

  const [status, setStatus] = useState(AppStatus.WaitingForWoW);
  const [openDialog, setDialog] = useState(false);

  const closeDialog = () => setDialog(false);
  const confirmStopRecording = () => setDialog(true);
  const stopRecording = () => {
    closeDialog();
    ipc.sendMessage('recorder', ['stop']);
  };

  const showIcon = (event: any, icon: string) => {
    event.target.src = icon;
  };

  /**
   * Update status handler.
   */
   useEffect(() => {
    window.electron.ipcRenderer.on('updateStatus', (status) => {
      setStatus(status as AppStatus);
    });
  }, []);

  const message = statusMessages[status];
  const isRecording = (status === AppStatus.Recording);

  return (
    <div id="status">
      <div>
        { isRecording ||
          <img id={ message.style + '-icon' } title={ message.title } alt="icon" src={ message.icon }/>
        }
        { isRecording &&
          <img
            id={ message.style + '-icon' }
            title={ message.title + ' - Click to stop recording' }
            onClick={confirmStopRecording}
            onMouseEnter={(e) => showIcon(e, stopRecordingIcon)}
            onMouseLeave={(e) => showIcon(e, message.icon)}
            alt="icon"
            src={ message.icon }
          />
        }
        <InformationDialog
          title='⚠️ Stop recording?'
          open={openDialog}
          buttons={['confirm', 'close']}
          default='close'
          onAction={stopRecording}
          onClose={closeDialog}
        >
          Manually stopping the recording isn't usually a great idea, but it can be necessary if there's a bug that prevents it from stopping on its own.
        </InformationDialog>
      </div>
    </div>
  );
}
