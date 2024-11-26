/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RawCombatant, RendererVideo } from 'main/types';
import { X } from 'lucide-react';
import { specializationById, WoWCharacterClassType } from 'main/constants';
import {
  getWoWClassColor,
  stopPropagation,
  combatantNameSort,
  getPlayerClass,
  isArenaUtil,
  isSoloShuffleUtil,
  povNameSort,
} from '../../rendererutils';
import { specImages } from '../../images';

interface IProps {
  video: RendererVideo;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function ViewpointSelection(props: IProps) {
  const { video, appState, setAppState } = props;
  const povs = [video, ...video.multiPov].sort(povNameSort);
  const { player, combatants } = povs[0];

  const isArena = isArenaUtil(povs[0]);

  const mapCombatants = (combatant: RawCombatant) => {
    const name = combatant._name;
    const matches = povs.filter((p) => p.player?._name === name);

    let cloudVideo: RendererVideo | null = null;
    let diskVideo: RendererVideo | null = null;

    let unitClass: WoWCharacterClassType = 'UNKNOWN';
    let currentlySelected = false;

    const { playingVideo } = appState;

    let videoToShow = povs.find((p) => p === playingVideo);

    if (!videoToShow) {
      [videoToShow] = povs;
    }

    const v = matches[0];
    unitClass = getPlayerClass(v);

    matches.forEach((rv: RendererVideo) => {
      if (rv.cloud) {
        cloudVideo = rv;
        currentlySelected =
          currentlySelected || playingVideo?.videoName === cloudVideo.videoName;
      } else {
        diskVideo = rv;
        currentlySelected =
          currentlySelected || playingVideo?.videoName === diskVideo.videoName;
      }
    });

    let specIcon: string | undefined;

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID
      );

      if (knownSpec) {
        specIcon = specImages[combatant._specID as keyof typeof specImages];
      }
    }

    const handleChangePov = (
      event: React.MouseEvent<HTMLElement> | undefined
    ) => {
      if (event) {
        stopPropagation(event);
      }

      let selection: RendererVideo | undefined;

      // When a user clicks on the raid frame selection, prioritize
      // a disk video if it's available. Disk videos are slightly
      // more responsive and can be clipped.
      if (diskVideo) {
        selection = diskVideo;
      } else if (cloudVideo) {
        selection = cloudVideo;
      }

      if (!selection) {
        return;
      }

      setAppState((prevState) => {
        return {
          ...prevState,
          playingVideo: selection,
        };
      });
    };

    const classColor =
      unitClass === 'UNKNOWN' ? 'gray' : getWoWClassColor(unitClass);

    const cursor = cloudVideo || diskVideo ? 'cursor-pointer' : '';
    const selected = currentlySelected
      ? 'border-2 border-[#bb4420] rounded-sm'
      : '';

    return (
      <div
        className={`w-[100px] h-[50px] ${cursor} ${selected}`}
        key={name}
        onClick={handleChangePov}
      >
        <Box
          sx={{
            display: 'flex',
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: classColor,
            border: '1px solid black',
            boxSizing: 'border-box',
            borderRadius: '2px',
            height: '100%',
            width: '100%',
          }}
        >
          {specIcon && (
            <Box
              key={combatant._GUID}
              component="img"
              src={specIcon}
              sx={{
                display: 'flex',
                position: 'absolute',
                height: '15px',
                width: '15px',
                top: '2px',
                left: '2px',
                border: '1px solid black',
                borderRadius: '15%',
                boxSizing: 'border-box',
                objectFit: 'cover',
              }}
            />
          )}
          <span className="font-sans text-black font-bold text-[10px] truncate">
            {name}
          </span>
        </Box>
      </div>
    );
  };

  const renderVersusSelection = () => {
    if (!player) {
      return <></>;
    }

    const friendly = combatants.filter((c) => c._teamID === player._teamID);
    const enemy = combatants.filter((c) => c._teamID !== player._teamID);
    let gridClass = 'grid my-1 mx-1 max-w-[500px] ';

    // some tailwind shenanigans going on here when I try to do this more dynamically.
    // pretty sure it's scanning these files to decide what to bundle so needs these
    // hardcoded.
    if (friendly.length === 2) {
      gridClass += 'grid-cols-2';
    } else if (friendly.length === 3) {
      gridClass += 'grid-cols-3';
    } else {
      gridClass += 'grid-cols-5';
    }

    const renderVsIcon = () => {
      return (
        <div className="flex justify-center">
          <X />
        </div>
      );
    };

    return (
      <div className="flex flex-col">
        <div className={gridClass}>{friendly.map(mapCombatants)}</div>
        {!isSoloShuffleUtil(povs[0]) && renderVsIcon()}
        <div className={gridClass}>{enemy.map(mapCombatants)}</div>
      </div>
    );
  };

  if (isArena) {
    // For arena modes we split the teams.
    return renderVersusSelection();
  }

  return (
    <div className="grid grid-cols-5 my-1 mx-1 max-w-[500px]">
      {combatants.sort(combatantNameSort).map(mapCombatants)}
    </div>
  );
}
