import { Box } from '@mui/material';
import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import * as Images from './images';

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

  const renderCombatant = (c: any) => {
    const specID = c._specID;
    const specIcon = Images.specImages[specID] || Images.specImages[0];

    return (
      <Box
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
    );
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
        {enemy.map(renderCombatant)}
      </Box>
      <CloseIcon />
      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
        {friendly.map(renderCombatant)}
      </Box>
    </>
  );
};

export default ArenaCompDisplay;
