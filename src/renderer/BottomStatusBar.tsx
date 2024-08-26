import { Crashes, MicStatus, RecStatus, SaveStatus } from 'main/types';
import Box from '@mui/material/Box';
import { Fade, LinearProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import DiscordButton from './DiscordButton';
import LogButton from './LogButton';
import RecorderStatus from './RecorderStatus';
import SavingStatus from './SavingStatus';
import TestButton from './TestButton';
import MicrophoneStatus from './MicrophoneStatus';
import CrashStatus from './CrashStatus';

interface IProps {
  recorderStatus: RecStatus;
  error: string;
  savingStatus: SaveStatus;
  micStatus: MicStatus;
  crashes: Crashes;
}

const BottomStatusBar: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, error, savingStatus, micStatus, crashes } = props;

  const [showUploadProgressBar, setShowUploadProgressBar] = useState(false);
  const [showDownloadProgressBar, setShowDownloadProgressBar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    const ipc = window.electron.ipcRenderer;

    ipc.on('updateUploadProgress', (progress) => {
      setShowUploadProgressBar(true);
      setUploadProgress(progress as number);

      if (progress === 100) {
        setTimeout(() => setShowUploadProgressBar(false), 1000);
      }
    });

    ipc.on('updateDownloadProgress', (progress) => {
      setShowDownloadProgressBar(true);
      setDownloadProgress(progress as number);

      if (progress === 100) {
        setTimeout(() => setShowDownloadProgressBar(false), 1000);
      }
    });
  }, []);

  const getUploadProgressBar = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <Fade in={showUploadProgressBar}>
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

  const getDownloadProgressBar = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <Fade in={showDownloadProgressBar}>
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
              value={downloadProgress}
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
              {downloadProgress}% Downloaded
            </Typography>
          </Box>
        </Fade>
      </Box>
    );
  };

  return (
    <div className="h-[35px] flex content-center items-center bg-background z-1 flex-row px-4">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '10%',
        }}
      >
        <RecorderStatus recorderStatus={recorderStatus} error={error} />
        <SavingStatus savingStatus={savingStatus} />
        <MicrophoneStatus micStatus={micStatus} />
        <CrashStatus crashes={crashes} />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80%',
        }}
      >
        {showUploadProgressBar && getUploadProgressBar()}
        {showDownloadProgressBar && getDownloadProgressBar()}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '10%',
        }}
      >
        <LogButton />
        <TestButton recorderStatus={recorderStatus} />
        <DiscordButton />
      </Box>
    </div>
  );
};

export default BottomStatusBar;
