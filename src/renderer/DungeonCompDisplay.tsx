import { Box, Typography } from '@mui/material';
import React from 'react';
import { specializationById } from 'main/constants';
import { RawCombatant, RendererVideo } from 'main/types';
import * as Images from './images';
import { getWoWClassColor } from './rendererutils';

interface IProps {
  video: RendererVideo;
}

const DungeonCompDisplay: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { combatants } = video;

  if (combatants === undefined) {
    return <></>;
  }

  if (combatants.length > 5 || combatants.length === 0) {
    return <></>;
  }

  const tanksAndHeals = combatants.filter((combatant: RawCombatant) => {
    if (combatant._specID === undefined) {
      return false;
    }

    if (specializationById[combatant._specID] === undefined) {
      return false;
    }

    return specializationById[combatant._specID].role !== 'damage';
  });

  const dps = combatants.filter((combatant: RawCombatant) => {
    if (combatant._specID === undefined) {
      return false;
    }

    if (specializationById[combatant._specID] === undefined) {
      return false;
    }

    return specializationById[combatant._specID].role === 'damage';
  });

  const renderCombatant = (combatant: RawCombatant) => {
    const specID = combatant._specID;
    let nameColor = 'grey';
    let specIcon = Images.specImages[0];

    if (specID !== undefined) {
      specIcon = Images.specImages[specID];
      const spec = specializationById[specID];
      nameColor = getWoWClassColor(spec.class);
    }

    return (
      <Box
        key={combatant._name}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'start',
        }}
      >
        <Box
          key={combatant._GUID}
          component="img"
          src={specIcon}
          sx={{
            height: '20px',
            width: '20px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
        <Typography
          sx={{
            color: nameColor,
            fontFamily: '"Arial",sans-serif',
            ml: '2px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {combatant._name}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'row',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        key="tanks-and-heals"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
          mr: 1,
        }}
      >
        {tanksAndHeals.map(renderCombatant)}
      </Box>

      <Box
        key="dps"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        {dps.map(renderCombatant)}
      </Box>
    </Box>
  );
};

export default DungeonCompDisplay;
