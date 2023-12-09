import { MicStatus } from 'main/types';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { Tooltip } from '@mui/material';

interface IProps {
  micStatus: MicStatus;
}

export default function MicrophoneStatus(props: IProps) {
  const { micStatus } = props;
  if (micStatus === MicStatus.LISTENING) {
    return (
      <Tooltip title="Listening">
        <MicIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Tooltip>
    );
  }

  if (micStatus === MicStatus.MUTED) {
    return (
      <Tooltip title="Muted">
        <MicOffIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Tooltip>
    );
  }

  return <></>;
}
