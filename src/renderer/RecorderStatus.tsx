import { useState, useEffect } from 'react';
import { RecStatus } from 'main/types';
import { DialogContentText } from '@mui/material';
import recordIcon from '../../assets/icon/record-icon.png';
import eyeIcon from '../../assets/icon/sleep-icon.png';
import errorIcon from '../../assets/icon/error-icon.png';
import watchIcon from '../../assets/icon/watch-icon.png';
import stopRecordingIcon from '../../assets/icon/stop-recording.png';
import InformationDialog from './InformationDialog';

type IconStyle = 'small' | 'big';

type StatusMessageObjectType = {
  title: string;
  style: IconStyle;
  icon: string;
};

const statusMessages: { [key: number]: StatusMessageObjectType } = {
  [RecStatus.Recording]: {
    style: 'big',
    icon: recordIcon,
    title: 'Recording',
  },
  [RecStatus.WaitingForWoW]: {
    style: 'small',
    icon: eyeIcon,
    title: 'Waiting for WoW to start',
  },
  [RecStatus.InvalidConfig]: {
    style: 'small',
    icon: errorIcon,
    title: 'Failed to start, check config is valid',
  },
  [RecStatus.ReadyToRecord]: {
    style: 'small',
    icon: watchIcon,
    title: 'Ready and waiting',
  },
};

export default function RecorderStatus() {
  const [status, setStatus] = useState(RecStatus.WaitingForWoW);
  const [invalidReason, setInvalidReason] = useState('');
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
    window.electron.ipcRenderer.on('updateRecStatus', (newStatus, reason) => {
      setStatus(newStatus as RecStatus);

      if (newStatus === RecStatus.InvalidConfig) {
        setInvalidReason(reason as string);
      }
    });
  }, []);

  const message = statusMessages[status];
  const isRecording = status === RecStatus.Recording;
  let mouseoverText;

  if (status === RecStatus.InvalidConfig) {
    mouseoverText = `${message.title}.\n${invalidReason}`;
  } else if (isRecording) {
    mouseoverText = `${message.title}.\nClick to stop recording.`;
  } else {
    mouseoverText = message.title;
  }

  return (
    <div id="status">
      <div>
        {isRecording || (
          <img
            id={`${message.style}-rec-status`}
            title={mouseoverText}
            alt="icon"
            src={message.icon}
          />
        )}
        {isRecording && (
          <img
            id={`${message.style}-rec-status`}
            title={mouseoverText}
            onClick={confirmStopRecording}
            onMouseEnter={(e) => showIcon(e, stopRecordingIcon)}
            onMouseLeave={(e) => showIcon(e, message.icon)}
            alt="icon"
            src={message.icon}
          />
        )}
        <InformationDialog
          title="⚠️ Stop recording?"
          open={openDialog}
          buttons={['confirm', 'close']}
          default="close"
          onAction={stopRecording}
          onClose={closeDialog}
        >
          <DialogContentText>
            Manually stopping the recording is not usually a great idea, but it
            can be necessary if there is a bug that prevents it from stopping on
            its own.
          </DialogContentText>
        </InformationDialog>
      </div>
    </div>
  );
}
