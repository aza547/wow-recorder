import React from 'react';
import Box from '@mui/material/Box';
import { RendererVideo } from 'main/types';
import {
  getInstanceDifficultyText,
  getResultColor,
  getVideoResultText,
} from './rendererutils';

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
      <span className="text-white font-sans font-semibold text-sm text-shadow-instance">
        {difficultyText}
      </span>
    );
  };

  const renderEncounterText = () => {
    return (
      <span className="text-white font-sans font-semibold text-lg text-shadow-instance text-center">
        {encounterName}
      </span>
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
        p: 1,
      }}
    >
      {renderDifficultyText()}
      {renderEncounterText()}
    </Box>
  );
};

export default RaidEncounterInfo;
