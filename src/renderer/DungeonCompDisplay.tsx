import { Box } from '@mui/material';
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
  let { combatants } = video;

  if (combatants === undefined || combatants.length === 0) {
    return <></>;
  }

  if (combatants.length > 5) {
    // Handle the case that there is somehow extra combatants by just taking
    // the first 5. This shouldn't really happen, but initially had problems
    // with outsiders bleeding into the run.
    combatants = combatants.slice(0, 5);
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
          alignItems: 'center',
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
        <span
          className="font-bold text-xs text-shadow-instance ml-0.5"
          style={{ color: nameColor }}
        >
          {combatant._name}
        </span>
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
