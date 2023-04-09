import { Box, Typography } from '@mui/material';
import React from 'react';
import { specializationById } from 'main/constants';
import * as Images from './images';
import { getWoWClassColor } from './rendererutils';

interface IProps {
  combatants: any;
}

const DungeonCompDisplay: React.FC<IProps> = (props: IProps) => {
  const { combatants } = props;

  if (combatants === undefined) {
    return <></>;
  }

  if (combatants.length > 5 || combatants.length === 0) {
    return <></>;
  }

  const tanksAndHeals = combatants.filter((c: any) => {
    if (specializationById[c._specID] === undefined) {
      return false;
    }

    return specializationById[c._specID].role !== 'damage';
  });

  const dps = combatants.filter((c: any) => {
    if (specializationById[c._specID] === undefined) {
      return false;
    }

    return specializationById[c._specID].role === 'damage';
  });

  const renderCombatant = (c: any) => {
    const specID = c._specID;
    let nameColor = 'black';
    let specIcon = Images.specImages[0];

    if (specID !== undefined) {
      specIcon = Images.specImages[specID];
      const spec = specializationById[c._specID];
      nameColor = getWoWClassColor(spec.class);
    }

    return (
      <Box
        key={c._name}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'start',
        }}
      >
        <Box
          key={c._GUID}
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
          {c._name}
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
