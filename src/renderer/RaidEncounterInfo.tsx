import React from 'react';
import Box from '@mui/material/Box';
import { Typography } from '@mui/material';

interface IProps {
  video: any;
}

const RaidEncounterInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { encounterName, zoneName } = video;

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
        }}
      >
        {zoneName}
      </Typography>
    </Box>
  );
};

export default RaidEncounterInfo;
