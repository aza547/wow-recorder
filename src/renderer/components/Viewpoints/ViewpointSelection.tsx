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
} from '../../rendererutils';
import { specImages } from '../../images';

interface IProps {
  povs: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function ViewpointSelection(props: IProps) {
  const { povs, appState, setAppState } = props;
  const { player, combatants } = povs[0];

  const isArena = isArenaUtil(povs[0]);

  const mapCombatants = (combatant: RawCombatant) => {
    const name = combatant._name;
    const matches = povs.filter((p) => p.player?._name === name);

    let cloudVideo: RendererVideo | null = null;
    let diskVideo: RendererVideo | null = null;

    let unitClass: WoWCharacterClassType = 'UNKNOWN';
    let currentlySelected = false;

    matches.forEach((rv: RendererVideo) => {
      const v = matches[0];
      unitClass = getPlayerClass(v);

      if (rv.cloud) {
        cloudVideo = rv;

        if (appState.playingVideo?.videoName === cloudVideo.videoName) {
          currentlySelected = true;
        }
      } else {
        diskVideo = rv;

        if (appState.playingVideo?.videoName === diskVideo.videoName) {
          currentlySelected = true;
        }
      }
    });

    let specIcon;

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

      let video = null;

      if (diskVideo) {
        video = diskVideo;
      } else if (cloudVideo) {
        video = cloudVideo;
      }

      if (video == null) {
        return;
      }

      setAppState((prevState) => {
        return {
          ...prevState,
          playingVideo: video,
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
    let klazz = 'grid my-1 mx-1 max-w-[500px] ';

    // some tailwind shenanigans going on here when I try to do this more dynamically.
    // pretty sure it's scanning these files to decide what to bundle so needs these
    // hardcoded.
    if (friendly.length === 2) {
      klazz += 'grid-cols-2';
    } else if (friendly.length === 3) {
      klazz += 'grid-cols-3';
    } else {
      klazz += 'grid-cols-5';
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
        <div className={klazz}>{friendly.map(mapCombatants)}</div>
        {!isSoloShuffleUtil(povs[0]) && renderVsIcon()}
        <div className={klazz}>{enemy.map(mapCombatants)}</div>
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
