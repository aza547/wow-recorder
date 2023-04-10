import { Box, Typography } from '@mui/material';
import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { specializationById } from 'main/constants';
import { RawCombatant, RendererVideo } from 'main/types';
import * as Images from './images';
import { getPlayerTeamID, getWoWClassColor } from './rendererutils';

interface IProps {
  video: RendererVideo;
}

const ArenaCompDisplay: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { combatants } = video;

  if (combatants === undefined) {
    return <></>;
  }

  const playerTeamID = getPlayerTeamID(video);

  const friendly = combatants.filter(
    (combatant: RawCombatant) => combatant._teamID !== playerTeamID
  );

  const enemy = combatants.filter(
    (combatant: RawCombatant) => combatant._teamID === playerTeamID
  );

  if (friendly.length > 5 || friendly.length === 0) {
    return <></>;
  }

  if (enemy.length > 5 || enemy.length === 0) {
    return <></>;
  }

  if (enemy.length !== friendly.length) {
    return <></>;
  }

  const renderEnemyCombatant = (combatant: RawCombatant) => {
    let nameColor = 'grey';
    let specIcon = Images.specImages[0];

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID
      );

      if (knownSpec) {
        specIcon = Images.specImages[combatant._specID];
        const spec = specializationById[combatant._specID];
        nameColor = getWoWClassColor(spec.class);
      }
    }

    return (
      <Box
        key={combatant._name}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'end',
        }}
      >
        <Typography
          sx={{
            color: nameColor,
            fontFamily: '"Arial",sans-serif',
            mr: '2px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {combatant._name}
        </Typography>
        <Box
          key={combatant._GUID}
          component="img"
          src={specIcon}
          sx={{
            height: '18px',
            width: '18px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
      </Box>
    );
  };

  const renderFriendlyCombatant = (combatant: RawCombatant) => {
    let nameColor = 'grey';
    let specIcon = Images.specImages[0];

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID
      );

      if (knownSpec) {
        specIcon = Images.specImages[combatant._specID];
        const spec = specializationById[combatant._specID];
        nameColor = getWoWClassColor(spec.class);
      }
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
            height: '18px',
            width: '18px',
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
        key="enemies"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        {enemy.map(renderEnemyCombatant)}
      </Box>
      <CloseIcon sx={{ color: 'white' }} />
      <Box
        key="friendlies"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        {friendly.map(renderFriendlyCombatant)}
      </Box>
    </Box>
  );
};

export default ArenaCompDisplay;
