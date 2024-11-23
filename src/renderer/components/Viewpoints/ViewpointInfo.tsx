/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject } from 'react';
import {
  getPlayerClass,
  getWoWClassColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
} from '../../rendererutils';
import * as Images from '../../images';

interface IProps {
  povs: RendererVideo[];
  parentButtonSelected: boolean;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

export default function ViewpointInfo(props: IProps) {
  const { parentButtonSelected, appState, setAppState, persistentProgress } =
    props;

  const { playingVideo } = appState;

  if (!playingVideo) {
    return <></>;
  }

  const playerName = getPlayerName(playingVideo);
  const playerRealm = getPlayerRealm(playingVideo);
  const playerClass = getPlayerClass(playingVideo);
  const playerClassColor = getWoWClassColor(playerClass);
  const playerSpecID = getPlayerSpecID(playingVideo);
  const specIcon = Images.specImages[playerSpecID];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
      }}
    >
      <Box
        component="img"
        src={specIcon}
        sx={{
          height: '50px',
          width: '50px',
          border: '1px solid black',
          borderRadius: '15%',
          boxSizing: 'border-box',
          objectFit: 'cover',
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          pl: 1,
        }}
      >
        <span
          className="font-sans font-semibold text-lg text-shadow-instance"
          style={{ color: playerClassColor }}
        >
          {playerName}
        </span>

        <span className="text-white font-sans font-semibold text-sm text-shadow-instance">
          {playerRealm}
        </span>
      </Box>
    </Box>
  );
}
