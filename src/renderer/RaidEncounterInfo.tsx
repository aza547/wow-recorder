import React from 'react';
import Box from '@mui/material/Box';
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
      <span className="text-white font-sans font-semibold text-xs text-shadow-instance">
        {difficultyText}
      </span>
    );
  };

  const renderEncounterText = () => {
    return (
      <span className="text-white font-sans font-semibold text-base text-shadow-instance text-center">
        {encounterName}
      </span>
    );
  };

  const renderZoneText = () => {
    if (unknownRaid) {
      return <></>;
    }

    return (
      <span className="text-white font-sans font-semibold text-xs text-shadow-instance">
        {zoneName}
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
      }}
    >
      {renderDifficultyText()}
      {renderEncounterText()}
      {renderZoneText()}
    </Box>
  );
};

export default RaidEncounterInfo;
