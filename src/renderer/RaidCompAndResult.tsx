import { Box, Typography } from '@mui/material';
import React from 'react';
import { RawCombatant, RendererVideo } from 'main/types';
import { specializationById } from 'main/constants';
import { getVideoResultText } from './rendererutils';
import * as Images from './images';

interface IProps {
  video: RendererVideo;
}

type RoleCount = {
  tank: number;
  healer: number;
  damage: number;
};

const RaidCompAndResult: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { combatants } = video;
  const resultText = getVideoResultText(video);

  const roleCount: RoleCount = {
    tank: 0,
    healer: 0,
    damage: 0,
  };

  combatants.forEach((combant: RawCombatant) => {
    const specID = combant._specID;

    if (specID === undefined) {
      return;
    }

    const spec = specializationById[specID];

    if (spec === undefined) {
      return;
    }

    const { role } = spec;
    roleCount[role]++;
  });

  const renderCounter = (role: string) => {
    return (
      <Box
        key={`parent-${role}`}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          p: '4px',
        }}
      >
        <Box
          key={`child-${role}`}
          component="img"
          src={Images.roleImages[role]}
          sx={{
            height: '20px',
            width: '20px',
            objectFit: 'cover',
          }}
        />
        <Typography
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
            ml: '2px',
            fontSize: '1rem',
            fontWeight: 700,
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {roleCount[role as keyof RoleCount]}
        </Typography>
      </Box>
    );
  };

  const renderRaidComp = () => {
    if (combatants.length < 1) {
      return <></>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {Object.keys(roleCount).map(renderCounter)}
      </Box>
    );
  };

  const renderResultText = () => {
    return (
      <Typography
        align="center"
        sx={{
          color: 'white',
          fontWeight: '600',
          fontFamily: '"Arial",sans-serif',
          fontSize: '1.5rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {resultText}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderResultText()}
      {renderRaidComp()}
    </Box>
  );
};

export default RaidCompAndResult;
