import { Box } from '@mui/material';
import { AppState, RawCombatant, RendererVideo } from 'main/types';
import { X } from 'lucide-react';
import { specializationById, WoWCharacterClassType } from 'main/constants';
import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  getWoWClassColor,
  stopPropagation,
  combatantNameSort,
  getPlayerClass,
  isArenaUtil,
  isSoloShuffleUtil,
  povDiskFirstNameSort,
} from '../../rendererutils';
import { specImages } from '../../images';

interface IProps {
  video: RendererVideo;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

export default function ViewpointSelection(props: IProps) {
  const { video, appState, setAppState, persistentProgress } = props;
  const { selectedVideos, multiPlayerMode } = appState;

  const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);
  const { player, combatants } = povs[0];

  const isArena = isArenaUtil(povs[0]);

  const mapCombatants = (combatant: RawCombatant) => {
    const name = combatant._name;
    const matches = povs.filter((p) => p.player?._name === name);

    let cloudVideo: RendererVideo | null = null;
    let diskVideo: RendererVideo | null = null;

    let unitClass: WoWCharacterClassType = 'UNKNOWN';
    let currentlySelected = false;

    if (matches.length > 0) {
      // We only bother to get a class if we have a match. That way the
      // combatants we have a viewpoint for will be colored, else they will
      // be gray.
      const v = matches[0];
      unitClass = getPlayerClass(v);
    }

    matches.forEach((rv: RendererVideo) => {
      if (rv.cloud) {
        cloudVideo = rv;
      } else {
        diskVideo = rv;
      }

      if (!currentlySelected) {
        // We haven't identified if this players point of view is selected
        // yet. Either look in the selected videos list for this info, or
        // look at the first selection in the event that there are none selected
        // yet (i.e. we've just started the app, or just changed category).
        currentlySelected =
          selectedVideos.length > 0
            ? selectedVideos.some((sv) => sv.videoName === rv.videoName)
            : povs[0].player?._name === rv.player?._name;
      }
    });

    let specIcon: string | undefined;

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID,
      );

      if (knownSpec) {
        specIcon = specImages[combatant._specID as keyof typeof specImages];
      }
    }

    const handleChangePov = (
      event: React.MouseEvent<HTMLElement> | undefined,
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

      const sameActivity =
        selectedVideos[0]?.uniqueHash === selection.uniqueHash;

      if (!sameActivity) {
        persistentProgress.current = 0;
      }

      // Clone the selected videos for manipulation.
      let s = [...selectedVideos];

      if (multiPlayerMode) {
        // We're in multiplayer mode. This click should either select a new video or
        // deselect a currently selected video, with the caveats we don't allow more
        // than 4 videos selected at once.
        if (currentlySelected) {
          // The video is already selected. So deselect it if it's not the only
          // selected video. If it is the only selected video, do nothing.
          if (selectedVideos.length < 2) return;
          s = s.filter((rv) => rv.videoName !== selection.videoName);
        } else {
          // The video is not already selected. So select it if we've not already got
          // the max of four selected videos. If we do, then do nothing.
          if (selectedVideos.length > 3) return;
          s.push(selection);
        }
      } else {
        // We're in single player mode. This click should just change to
        // selection to the target of the click.
        s = [selection];
      }

      setAppState((prevState) => {
        // If we are changing video, reset the playing and multi-player.
        const playing = sameActivity ? prevState.playing : false;
        const mode = sameActivity ? prevState.multiPlayerMode : false;

        return {
          ...prevState,
          selectedVideos: s,
          // If we are deselecting a video to leave one remaining, revert the
          // video player to single player mode.
          multiPlayerMode: s.length > 1 ? mode : false,
          // Always pause if changing selections in multiplayer mode.
          playing: multiPlayerMode ? false : playing,
        };
      });
    };

    const classColor =
      unitClass === 'UNKNOWN' ? 'gray' : getWoWClassColor(unitClass);

    const cursor = cloudVideo || diskVideo ? 'cursor-pointer' : '';
    const selected = currentlySelected
      ? 'border-2 border-[#bb4420] rounded-sm'
      : '';

    const selectedPlayerNames = selectedVideos
      .map((rv) => rv.player?._name)
      .filter((item): item is string => item !== undefined);

    const idx =
      currentlySelected && name ? selectedPlayerNames.indexOf(name) + 1 : -1;

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
          {multiPlayerMode && idx > 0 && (
            <div className="absolute flex items-center justify-center top-[2px] right-[2px] text-black font-bold text-[10px] h-[15px] w-[15px]">
              {idx}
            </div>
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
    let gridClass = 'grid my-1 mx-1 ';

    // some tailwind shenanigans going on here when I try to do this more dynamically.
    // pretty sure it's scanning these files to decide what to bundle so needs these
    // hardcoded.
    if (friendly.length === 2) {
      gridClass += 'grid-rows-2';
    } else if (friendly.length === 3) {
      gridClass += 'grid-rows-3';
    } else {
      gridClass += 'grid-rows-5';
    }

    const renderVsIcon = () => {
      return (
        <div className="flex justify-center">
          <X />
        </div>
      );
    };

    return (
      <div className="flex flex-row items-center">
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
    <div className="grid grid-cols-5 my-1 mx-1">
      {combatants.sort(combatantNameSort).map(mapCombatants)}
    </div>
  );
}
