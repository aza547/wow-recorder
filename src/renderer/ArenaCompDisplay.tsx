import { Box, Typography } from '@mui/material';
import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { specializationById } from 'main/constants';
import * as Images from './images';
import { getWoWClassColor } from './rendererutils';

interface IProps {
  combatants: any;
  playerTeamID: number;
}

const ArenaCompDisplay: React.FC<IProps> = (props: IProps) => {
  const { combatants, playerTeamID } = props;

  const friendly = combatants.filter((c: any) => c._teamID !== playerTeamID);
  const enemy = combatants.filter((c: any) => c._teamID === playerTeamID);

  if (friendly.length > 5 || friendly.length === 0) {
    return <></>;
  }

  if (enemy.length > 5 || enemy.length === 0) {
    return <></>;
  }

  if (enemy.length !== friendly.length) {
    return <></>;
  }

  const renderEnemyCombatant = (c: any) => {
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
          }}
        >
          {c._name}
        </Typography>
        <Box
          key={c._GUID}
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

  const renderFriendlyCombatant = (c: any) => {
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
