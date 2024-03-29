import {
  Crashes,
  MicStatus,
  RecStatus,
  SaveStatus,
  UpgradeStatus,
} from 'main/types';
import Box from '@mui/material/Box';
import { Fade, LinearProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
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

  const [showProgressBar, setShowProgressBar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    const ipc = window.electron.ipcRenderer;

    ipc.on('updateUploadProgress', (progress) => {
      setShowProgressBar(true);
      setUploadProgress(progress as number);

      if (progress === 100) {
        setTimeout(() => setShowProgressBar(false), 1000);
      }
    });
  }, []);

  const getUploadProgressBar = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <Fade in={showProgressBar}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{
                minWidth: '300px',
                height: '15px',
                borderRadius: '2px',
                border: '1px solid black',
                backgroundColor: 'white',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#bb4420',
                },
              }}
            />
            <Typography
              sx={{
                color: 'white',
                fontSize: '0.75rem',
                mx: '5px',
              }}
            >
              {uploadProgress}% Uploaded
            </Typography>
          </Box>
        </Fade>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        borderTop: '1px solid black',
        height: '35px',
        boxSizing: 'border-box',
        alignItems: 'flex-end',
        backgroundColor: '#182035',
        zIndex: 1,
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
            justifyContent: 'center',
          }}
        >
          {getUploadProgressBar()}
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
