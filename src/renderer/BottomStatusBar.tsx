import {
  Crashes,
  MicStatus,
  RecStatus,
  SaveStatus,
  UpgradeStatus,
} from 'main/types';
import Box from '@mui/material/Box';
import DiscordButton from './DiscordButton';
import LogButton from './LogButton';
import RecorderStatus from './RecorderStatus';
import SavingStatus from './SavingStatus';
import TestButton from './TestButton';
import VersionUpdateWidget from './VersionUpdateWidget';
import MicrophoneStatus from './MicrophoneStatus';
import CrashStatus from './CrashStatus';

interface IProps {
  recorderStatus: RecStatus;
  error: string;
  upgradeStatus: UpgradeStatus;
  savingStatus: SaveStatus;
  micStatus: MicStatus;
  crashes: Crashes;
}

const BottomStatusBar: React.FC<IProps> = (props: IProps) => {
  const {
    recorderStatus,
    error,
    upgradeStatus,
    savingStatus,
    micStatus,
    crashes,
  } = props;

  return (
    <Box
      sx={{
        borderTop: '1px solid black',
        height: '35px',
        boxSizing: 'border-box',
        alignItems: 'flex-end',
        backgroundColor: '#182035',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ml: 1,
          mr: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <RecorderStatus recorderStatus={recorderStatus} error={error} />
          <VersionUpdateWidget upgradeStatus={upgradeStatus} />
          <SavingStatus savingStatus={savingStatus} />
          <MicrophoneStatus micStatus={micStatus} />
          <CrashStatus crashes={crashes} />
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <LogButton />
          <TestButton recorderStatus={recorderStatus} />
          <DiscordButton />
        </Box>
      </Box>
    </Box>
  );
};

export default BottomStatusBar;
