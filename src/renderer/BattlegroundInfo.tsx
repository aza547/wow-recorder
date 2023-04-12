import React from 'react';
import Box from '@mui/material/Box';
import { Typography } from '@mui/material';
import { RendererVideo } from 'main/types';

interface IProps {
  video: RendererVideo;
}

const BattlegroundInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { zoneName } = video;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 700,
          fontSize: '1.5rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {zoneName}
      </Typography>
    </Box>
  );
};

export default BattlegroundInfo;
