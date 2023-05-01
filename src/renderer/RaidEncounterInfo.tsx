import React from 'react';
import Box from '@mui/material/Box';
import { Typography } from '@mui/material';
import { RendererVideo } from 'main/types';
import { getInstanceDifficultyText } from './rendererutils';

interface IProps {
  video: RendererVideo;
}

const RaidEncounterInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { encounterName, zoneName } = video;
  const difficultyText = getInstanceDifficultyText(video);

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
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 700,
          fontSize: '0.75rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {difficultyText}
      </Typography>

      <Typography
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 700,
          fontSize: '1.25rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {encounterName}
      </Typography>

      <Typography
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 500,
          fontSize: '0.75rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {zoneName}
      </Typography>
    </Box>
  );
};

export default RaidEncounterInfo;
