import React from 'react';
import Box from '@mui/material/Box';
import { Typography } from '@mui/material';
import { getInstanceDifficulty } from 'main/helpers';

interface IProps {
  video: any;
}

const RaidEncounterInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { encounterName, zoneName, difficultyID } = video;
  const videoInstanceDifficulty = getInstanceDifficulty(difficultyID);

  let difficultyText = '-';

  if (videoInstanceDifficulty) {
    difficultyText = videoInstanceDifficulty.difficulty;
  }

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
          fontSize: '0.75rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {difficultyText}
      </Typography>

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
        {encounterName}
      </Typography>

      <Typography
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
