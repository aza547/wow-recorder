import recordIcon from '../../assets/icon/record-icon.png';
import eyeIcon from  '../../assets/icon/sleep-icon.png';
import errorIcon from  '../../assets/icon/error-icon.png';
import watchIcon from  '../../assets/icon/watch-icon.png';
import stopRecordingIcon from '../../assets/icon/stop-recording.png';
import { useState, useEffect } from 'react';
import { RecStatus } from 'main/types';
import InformationDialog from './InformationDialog';

type IconStyle = 'small' | 'big';

type StatusMessageObjectType = {
  title: string,
  style: IconStyle,
  icon: string,
};

const statusMessages: { [key: number]: StatusMessageObjectType } = {
  [RecStatus.Recording]:     { style: 'big',   icon: recordIcon, title: 'Recording' },
  [RecStatus.WaitingForWoW]: { style: 'small', icon: eyeIcon,    title: 'Waiting for WoW to start' },
  [RecStatus.InvalidConfig]: { style: 'small', icon: errorIcon,  title: 'Failed to launch, check config is valid' },
  [RecStatus.ReadyToRecord]: { style: 'small', icon: watchIcon,  title: 'Ready and waiting'},
};

export default function RecorderStatus() {
  const [status, setStatus] = useState(RecStatus.WaitingForWoW);
  const [openDialog, setDialog] = useState(false);

  const closeDialog = () => setDialog(false);
  const confirmStopRecording = () => setDialog(true);

  const stopRecording = () => {
    closeDialog();
    window.electron.ipcRenderer.sendMessage('recorder', ['stop']);
  };

  const showIcon = (event: any, icon: string) => {
    event.target.src = icon;
  };

  useEffect(() => {
    window.electron.ipcRenderer.on('updateRecStatus', (status) => {
    setStatus(status as RecStatus);
    });
  }, []);

  const message = statusMessages[status];
  const isRecording = (status === RecStatus.Recording);

  return (
    <div id="status">
      <div>
        { isRecording ||
          <img 
            id={ message.style + '-rec-status' } 
            title={ message.title } 
            alt="icon" 
            src={ message.icon }
          />
        }
        { isRecording &&
          <img
            id={ message.style + '-rec-status' }
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
