/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RawCombatant, RendererVideo } from 'main/types';
import { MutableRefObject } from 'react';
import { WoWCharacterClassType } from 'main/constants';
import {
  getPlayerClass,
  getWoWClassColor,
  stopPropagation,
  combatantNameSort,
} from '../../rendererutils';

interface IProps {
  povs: RendererVideo[];
  parentButtonSelected: boolean;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

export default function ViewpointSelection(props: IProps) {
  const {
    povs,
    parentButtonSelected,
    appState,
    setAppState,
    persistentProgress,
  } = props;

  // /**
  //  * A group of POVs are the same POV from the same player and may contain
  //  * either a disk video, a cloud video or both.
  //  */
  // const getGroupListItem = (group: RendererVideo[]) => {
  //   const diskVideos = group.filter((vid) => !vid.cloud);
  //   const cloudVideos = group.filter((vid) => vid.cloud);

  //   const haveDiskVideo = diskVideos.length !== 0;
  //   const haveCloudVideo = cloudVideos.length !== 0;

  //   const cloudVideo = cloudVideos[0];
  //   const diskVideo = diskVideos[0];

  //   const cloudIndex = povs.indexOf(cloudVideo);
  //   const diskIndex = povs.indexOf(diskVideo);

  //   const cloudSelected = localPovIndex === cloudIndex;
  //   const diskSelected = localPovIndex === diskIndex;

  //   const cloudButtonColor = cloudSelected ? '#bb4420' : 'white';
  //   const diskButtonColor = diskSelected ? '#bb4420' : 'white';

  //   // Safe to just use the zeroth video here, all the details we pull out
  //   // are guarenteed to be the same for all videos in this group./
  //   const v = group[0];
  //   const name = getPlayerName(v);
  //   const specID = getPlayerSpecID(v);
  //   const icon = Images.specImages[specID];
  //   const unitClass = getPlayerClass(v);
  //   const classColor =
  //     unitClass === 'UNKNOWN' ? 'gray' : getWoWClassColor(unitClass);

  //   /**
  //    * Update state variables following a change of selected point of view.
  //    */
  //   const handleChangePov = (
  //     event: React.MouseEvent<HTMLElement> | undefined,
  //     povIndex: number
  //   ) => {
  //     if (event) {
  //       stopPropagation(event);
  //     }

  //     const video = povs[povIndex];

  //     if (!parentButtonSelected) {
  //       persistentProgress.current = 0;
  //     }

  //     setAppState((prevState) => {
  //       return {
  //         ...prevState,
  //         selectedVideoName: video.videoName,
  //         playingVideo: povs[povIndex],
  //       };
  //     });
  //   };

  //   /**
  //    * Return the cloud icon.
  //    */
  //   const getCloudIcon = () => {
  //     let opacity = 1;
  //     let title = 'Use cloud version';

  //     if (!haveCloudVideo) {
  //       opacity = 0.2;
  //       title = 'No cloud recording is saved';
  //     }

  //     return (
  //       <Tooltip content={title}>
  //         <ToggleGroupItem
  //           value={cloudIndex.toString()}
  //           disabled={!haveCloudVideo}
  //           onClick={(e) => handleChangePov(e, cloudIndex)}
  //           className="!pointer-events-auto"
  //         >
  //           <CloudIcon
  //             sx={{
  //               height: '15px',
  //               width: '15px',
  //               color: cloudButtonColor,
  //               opacity,
  //             }}
  //           />
  //         </ToggleGroupItem>
  //       </Tooltip>
  //     );
  //   };

  //   /**
  //    * Return the disk icon.
  //    */
  //   const getDiskIcon = () => {
  //     let opacity = 1;
  //     let title = 'Use local disk version';

  //     if (!haveDiskVideo) {
  //       opacity = 0.2;
  //       title = 'No disk recording is saved';
  //     }

  //     return (
  //       <Tooltip content={title}>
  //         <ToggleGroupItem
  //           value={diskIndex.toString()}
  //           disabled={!haveDiskVideo}
  //           onClick={(e) => handleChangePov(e, diskIndex)}
  //         >
  //           <SaveIcon
  //             sx={{
  //               height: '15px',
  //               width: '15px',
  //               color: diskButtonColor,
  //               opacity,
  //             }}
  //           />
  //         </ToggleGroupItem>
  //       </Tooltip>
  //     );
  //   };

  //   return (
  //     <div
  //       className="w-[100px] h-[50px]"
  //       key={name}
  //       onClick={(event) => {
  //         if (haveCloudVideo) {
  //           handleChangePov(event, cloudIndex);
  //         } else {
  //           handleChangePov(event, diskIndex);
  //         }
  //       }}
  //     >
  //       <Box
  //         sx={{
  //           display: 'flex',
  //           flexDirection: 'row',
  //           alignItems: 'center',
  //           justifyContent: 'center',
  //           backgroundColor: classColor,
  //           border: '1px solid black',
  //           boxSizing: 'border-box',
  //           borderRadius: '2px',
  //           height: '100%',
  //           width: '100%',
  //         }}
  //       >
  //         <span className="font-sans text-black font-bold text-[10px] truncate">
  //           {name}
  //         </span>
  //       </Box>
  //     </div>
  //   );
  // };

  // /**
  //  * Group the povs by name, grouping disk and cloud POVs for the
  //  * same video into a single group.
  //  */
  // const groupByName = (arr: RendererVideo[]) => {
  //   return arr.reduce((acc: Record<string, RendererVideo[]>, obj) => {
  //     const { videoName } = obj;

  //     if (!acc[videoName]) {
  //       acc[videoName] = [];
  //     }

  //     acc[videoName].push(obj);
  //     return acc;
  //   }, {});
  // };

  // const povsArray = Object.values(groupByName(povs));
  const { combatants } = povs[0];

  const mapCombatants = (combatant: RawCombatant) => {
    const name = combatant._name;

    const matches = povs.filter((p) => p.player?._name === name);

    let unitClass: WoWCharacterClassType = 'UNKNOWN';
    // const unitClass = getPlayerClass(v);

    let cloudVideo: RendererVideo | null = null;
    let diskVideo: RendererVideo | null = null;

    if (matches.length > 0) {
      const v = matches[0];
      unitClass = getPlayerClass(v);

      matches.forEach((rv: RendererVideo) => {
        if (rv.cloud) {
          cloudVideo = rv;
        } else {
          diskVideo = rv;
        }
      });
    }

    let currentlySelected = false;

    if (
      appState.selectedVideoName === diskVideo?.videoName ||
      appState.selectedVideoName === cloudVideo?.videoName
    ) {
      currentlySelected = true;
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

      if (!parentButtonSelected) {
        persistentProgress.current = 0;
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
