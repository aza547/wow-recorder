/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RawCombatant, RendererVideo } from 'main/types';
import { WoWCharacterClassType } from 'main/constants';
import {
  getWoWClassColor,
  stopPropagation,
  combatantNameSort,
  getPlayerClass,
} from '../../rendererutils';

interface IProps {
  povs: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function ViewpointSelection(props: IProps) {
  const { povs, appState, setAppState } = props;
  const { combatants } = povs[0];

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

        if (appState.selectedVideoName === cloudVideo.videoName) {
          currentlySelected = true;
        }
      } else {
        diskVideo = rv;

        if (appState.selectedVideoName === diskVideo.videoName) {
          currentlySelected = true;
        }
      }
    });

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
          selectedVideoName: video.videoName,
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
          <span className="font-sans text-black font-bold text-[10px] truncate">
            {name}
          </span>
        </Box>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-5 my-1 mx-1 max-w-[500px]">
      {combatants.sort(combatantNameSort).map(mapCombatants)}
    </div>
  );
}
