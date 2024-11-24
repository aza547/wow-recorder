/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RendererVideo } from 'main/types';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { ToggleGroup, ToggleGroupItem } from '../ToggleGroup/ToggleGroup';
import {
  getPlayerClass,
  getWoWClassColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  povNameSort,
} from '../../rendererutils';
import { specImages } from '../../images';
import { Tooltip } from '../Tooltip/Tooltip';

interface IProps {
  video: RendererVideo;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function ViewpointInfo(props: IProps) {
  const { video, appState, setAppState } = props;
  const povs = [video, ...video.multiPov].sort(povNameSort);
  const { playingVideo } = appState;

  if (!playingVideo) {
    return <></>;
  }

  const playerName = getPlayerName(playingVideo);
  const playerRealm = getPlayerRealm(playingVideo);
  const playerClass = getPlayerClass(playingVideo);
  const playerClassColor = getWoWClassColor(playerClass);
  const playerSpecID = getPlayerSpecID(playingVideo);
  const specIcon = specImages[playerSpecID as keyof typeof specImages];

  const pl = playingVideo.player;

  if (!pl) {
    return <></>;
  }

  const playerViewpoints = povs.filter((p) => p.player?._name === pl._name);
  const diskVideo = playerViewpoints.find((vid) => !vid.cloud);
  const cloudVideo = playerViewpoints.find((vid) => vid.cloud);

  const setPlayingVideo = (v: RendererVideo | undefined) => {
    if (!v) {
      return;
    }

    setAppState((p) => {
      return {
        ...p,
        playingVideo: v,
      };
    });
  };

  /**
   * Return the cloud icon.
   */
  const getCloudIcon = () => {
    const isSelected = appState.playingVideo === cloudVideo;
    const color = cloudVideo ? 'white' : 'gray';
    const opacity = isSelected ? 1 : 0.3;

    return (
      <Tooltip content="Use cloud version">
        <ToggleGroupItem
          value="cloud"
          disabled={!cloudVideo}
          onClick={() => setPlayingVideo(cloudVideo)}
          className="h-[40px] w-[40px]"
        >
          <CloudIcon
            sx={{
              height: '30px',
              width: '30px',
              color,
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
    const isSelected = appState.playingVideo === diskVideo;
    const color = diskVideo ? 'white' : 'gray';
    const opacity = isSelected ? 1 : 0.3;

    return (
      <Tooltip content="Use local disk version">
        <ToggleGroupItem
          value="disk"
          disabled={!diskVideo}
          onClick={() => setPlayingVideo(diskVideo)}
          className="h-[40px] w-[40px]"
        >
          <SaveIcon sx={{ height: '30px', width: '30px', color, opacity }} />
        </ToggleGroupItem>
      </Tooltip>
    );
  };

  const getVideoSourceToggle = () => {
    return (
      <div className="flex flex-row items-center content-center w-full h-full mx-2">
        <ToggleGroup
          type="single"
          className="flex flex-row items-center w-[100px] h-[50px]"
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
