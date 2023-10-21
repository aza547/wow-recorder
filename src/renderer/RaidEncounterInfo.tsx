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
  const unknownRaid = video.zoneName === 'Unknown Raid';

  const renderDifficultyText = () => {
    return (
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
    );
  };

  const renderEncounterText = () => {
    return (
      <Typography
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 700,
          fontSize: '1rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {encounterName}
      </Typography>
    );
  };

  const renderZoneText = () => {
    if (!unknownRaid) {
      return <></>;
    }

    return (
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
    );
  };

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
      {renderDifficultyText()}
      {renderEncounterText()}
      {renderZoneText()}
    </Box>
  );
};

export default RaidEncounterInfo;
