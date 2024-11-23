/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject } from 'react';
import { icon } from '@fortawesome/fontawesome-svg-core';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { ToggleGroup, ToggleGroupItem } from '../ToggleGroup/ToggleGroup';
import {
  getPlayerClass,
  getWoWClassColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
} from '../../rendererutils';
import * as Images from '../../images';
import { Tooltip } from '../Tooltip/Tooltip';

interface IProps {
  povs: RendererVideo[];
  parentButtonSelected: boolean;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

export default function ViewpointInfo(props: IProps) {
  const {
    povs,
    parentButtonSelected,
    appState,
    setAppState,
    persistentProgress,
  } = props;

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

  const pl = playingVideo.player;

  if (!pl) {
    return <></>;
  }

  const playerViewpoints = povs.filter((p) => p.player?._name === pl._name);
  const diskVideo = playerViewpoints.find((vid) => !vid.cloud);
  const cloudVideo = playerViewpoints.find((vid) => vid.cloud);

  const cloudButtonColor = 1 ? '#bb4420' : 'white';
  const diskButtonColor = 1 ? '#bb4420' : 'white';

  const setPlayingVideo = (v: RendererVideo | undefined) => {
    if (!v) {
      return;
    }

    setAppState((p) => {
      return {
        ...p,
        playingVideo: v,
        selectedVideoName: v.videoName,
      };
    });
  };

  /**
   * Return the cloud icon.
   */
  const getCloudIcon = () => {
    let opacity = 1;
    let title = 'Use cloud version';
    let value = 'none';

    if (!cloudVideo) {
      opacity = 0.2;
      title = 'No cloud recording is saved';
    } else {
      value = cloudVideo.videoName;
    }

    return (
      <Tooltip content={title}>
        <ToggleGroupItem
          value={value}
          disabled={!cloudVideo}
          onClick={() => setPlayingVideo(cloudVideo)}
          className="!pointer-events-auto"
        >
          <CloudIcon
            sx={{
              height: '40px',
              width: '40px',
              color: cloudButtonColor,
              opacity,
            }}
          />
        </ToggleGroupItem>
      </Tooltip>
    );
  };

  /**
   * Return the disk icon.
   */
  const getDiskIcon = () => {
    let opacity = 1;
    let title = 'Use local disk version';
    let value = 'none';

    if (!diskVideo) {
      opacity = 0.2;
      title = 'No disk recording is saved';
    } else {
      value = diskVideo.videoName;
    }

    return (
      <Tooltip content={title}>
        <ToggleGroupItem
          value={value}
          disabled={!diskVideo}
          onClick={() => setPlayingVideo(diskVideo)}
        >
          <SaveIcon
            sx={{
              height: '40px',
              width: '40px',
              color: diskButtonColor,
              opacity,
            }}
          />
        </ToggleGroupItem>
      </Tooltip>
    );
  };

  const getVideoSourceToggle = () => {
    return (
      <div className="flex flex-row items-center content-center w-full h-full mx-2">
        <ToggleGroup
          type="single"
          value={(1 ? 'a' : 'b').toString()}
          className="flex flex-row items-center content-end w-[100px] h-[50px] bg-[rgba(0,0,0,25%)]"
          size="xs"
          variant="outline"
        >
          {getCloudIcon()}
          {getDiskIcon()}
        </ToggleGroup>
      </div>
    );
  };

  const getPlayerInfo = () => {
    return (
      <>
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
      </>
    );
  };

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
      {getVideoSourceToggle()}
      {getPlayerInfo()}
    </Box>
  );
}
