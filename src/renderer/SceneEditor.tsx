import { Box } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import { scrollBarSx } from 'main/constants';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import VideoSourceControls from './VideoSourceControls';
import AudioSourceControls from './AudioSourceControls';
import VideoBaseControls from './VideoBaseControls';

interface IProps {
  recorderStatus: RecStatus;
}

const boxColor = '#141b2d';

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        borderBottomLeftRadius: '6px',
      }}
      className="bg-background-higher pt-[32px]"
    >
      <Box sx={{ width: '100%', height: '60%' }}>
        <RecorderPreview />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '50%',
          overflowY: 'auto',
          ...scrollBarSx,
          '&::-webkit-scrollbar': {
            width: '1em',
          },
        }}
      >
        <Box
          sx={{
            backgroundColor: boxColor,
            border: '1px solid rgba(0, 0, 0, 0.6)',
            borderRadius: '5px',
            boxShadow: 3,
            p: 1,
            mt: 2,
            mx: 2,
            my: 1,
          }}
        >
          <VideoSourceControls />
        </Box>
        <Box
          sx={{
            backgroundColor: boxColor,
            border: '1px solid rgba(0, 0, 0, 0.6)',
            borderRadius: '5px',
            boxShadow: 3,
            p: 1,
            mx: 2,
            my: 1,
          }}
        >
          <VideoBaseControls recorderStatus={recorderStatus} />
        </Box>
        <Box
          sx={{
            backgroundColor: boxColor,
            border: '1px solid rgba(0, 0, 0, 0.6)',
            borderRadius: '5px',
            boxShadow: 3,
            p: 1,
            mx: 2,
            my: 1,
          }}
        >
          <AudioSourceControls />
        </Box>
        <Box
          sx={{
            backgroundColor: boxColor,
            border: '1px solid rgba(0, 0, 0, 0.6)',
            borderRadius: '5px',
            boxShadow: 3,
            p: 1,
            mx: 2,
            mt: 1,
            mb: 2,
          }}
        >
          <ChatOverlayControls />
        </Box>
      </Box>
    </Box>
  );
};

export default SceneEditor;
