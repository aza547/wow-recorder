/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Box } from '@mui/material';
import { AppState, RendererVideo } from 'main/types';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { MutableRefObject } from 'react';
import {
  getPlayerName,
  getPlayerSpecID,
  getPlayerClass,
  getWoWClassColor,
  stopPropagation,
} from './rendererutils';
import * as Images from './images';
import { Tooltip } from './components/Tooltip/Tooltip';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import { ScrollArea } from './components/ScrollArea/ScrollArea';

interface IProps {
  povs: RendererVideo[];
  parentButtonSelected: boolean;
  localPovIndex: number;
  setLocalPovIndex: React.Dispatch<React.SetStateAction<number>>;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

export default function PovSelection(props: IProps) {
  const {
    povs,
    parentButtonSelected,
    localPovIndex,
    setLocalPovIndex,
    setAppState,
    persistentProgress,
  } = props;

  /**
   * A group of POVs are the same POV from the same player and may contain
   * either a disk video, a cloud video or both.
   */
  const getGroupListItem = (group: RendererVideo[]) => {
    const diskVideos = group.filter((vid) => !vid.cloud);
    const cloudVideos = group.filter((vid) => vid.cloud);

    const haveDiskVideo = diskVideos.length !== 0;
    const haveCloudVideo = cloudVideos.length !== 0;

    const cloudVideo = cloudVideos[0];
    const diskVideo = diskVideos[0];

    const cloudIndex = povs.indexOf(cloudVideo);
    const diskIndex = povs.indexOf(diskVideo);

    const cloudSelected = localPovIndex === cloudIndex;
    const diskSelected = localPovIndex === diskIndex;
    const povSelected = cloudSelected || diskSelected;

    const cloudButtonColor = cloudSelected ? '#bb4420' : 'white';
    const diskButtonColor = diskSelected ? '#bb4420' : 'white';

    // Safe to just use the zeroth video here, all the details we pull out
    // are guarenteed to be the same for all videos in this group./
    const v = group[0];
    const name = getPlayerName(v);
    const specID = getPlayerSpecID(v);
    const icon = Images.specImages[specID];
    const unitClass = getPlayerClass(v);
    const classColor =
      unitClass === 'UNKNOWN' ? 'gray' : getWoWClassColor(unitClass);

    /**
     * Update state variables following a change of selected point of view.
     */
    const handleChangePov = (
      event: React.MouseEvent<HTMLElement> | undefined,
      povIndex: number
    ) => {
      if (event) {
        stopPropagation(event);
      }
      setLocalPovIndex(povIndex);
      const video = povs[povIndex];

      if (!parentButtonSelected) {
        persistentProgress.current = 0;
      }

      setAppState((prevState) => {
        return {
          ...prevState,
          selectedVideoName: video.videoName,
          playingVideo: povs[povIndex],
        };
      });
    };

    /**
     * Return the cloud icon.
     */
    const getCloudIcon = () => {
      let opacity = 1;
      let title = 'Use cloud version';

      if (!haveCloudVideo) {
        opacity = 0.2;
        title = 'No cloud recording is saved';
      }

      return (
        <Tooltip content={title}>
          <ToggleGroupItem
            value={cloudIndex.toString()}
            disabled={!haveCloudVideo}
            onClick={(e) => handleChangePov(e, cloudIndex)}
          >
            <CloudIcon
              sx={{
                height: '15px',
                width: '15px',
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

      if (!haveDiskVideo) {
        opacity = 0.2;
        title = 'No disk recording is saved';
      }

      return (
        <Tooltip content={title}>
          <ToggleGroupItem
            value={diskIndex.toString()}
            disabled={!haveDiskVideo}
            onClick={(e) => handleChangePov(e, diskIndex)}
          >
            <SaveIcon
              sx={{
                height: '15px',
                width: '15px',
                color: diskButtonColor,
                opacity,
              }}
            />
          </ToggleGroupItem>
        </Tooltip>
      );
    };

    return (
      <div className="w-full h-auto rounded-md" key={name}>
        <div
          className="flex w-full h-full items-center content-center p-0"
          // selected={povSelected}
          onClick={(event) => {
            if (haveCloudVideo) {
              handleChangePov(event, cloudIndex);
            } else {
              handleChangePov(event, diskIndex);
            }
          }}
        >
          <div className="flex flex-row items-center content-center w-full h-full">
            <ToggleGroup
              type="single"
              value={(diskSelected ? diskIndex : cloudIndex).toString()}
              className="flex flex-row items-center content-end w-[50px] bg-[rgba(0,0,0,25%)] "
              size="xs"
              variant="outline"
            >
              {getCloudIcon()}
              {getDiskIcon()}
            </ToggleGroup>
            <img
              className="h-[25px] w-[25px] border border-black rounded-sm box-border object-cover"
              src={icon}
              alt="class-icon"
            />
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
                height: '25px',
                width: '100%',
              }}
            >
              <span className="font-sans text-black font-bold text-xs">
                {name}
              </span>
            </Box>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Group the povs by name, grouping disk and cloud POVs for the
   * same video into a single group.
   */
  const groupByName = (arr: RendererVideo[]) => {
    return arr.reduce((acc: Record<string, RendererVideo[]>, obj) => {
      const { videoName } = obj;

      if (!acc[videoName]) {
        acc[videoName] = [];
      }

      acc[videoName].push(obj);
      return acc;
    }, {});
  };

  const povsArray = Object.values(groupByName(povs));

  return (
    <div className="flex items-center content-center flex-col max-h-full w-full relative">
      {/* 
        If we don't have more than three, we don't want to render a scrollable area.

        This is because it's a faff to vertically center <3 elements within that area, so let's just forego it.
      */}
      {povsArray.length > 5 ? (
        <>
          <ScrollArea
            className="h-[150px]"
            scrollabilityIndicatorClasses="*:text-black"
          >
            <div className="flex w-[250px] flex-col p-0 my-1 mx-2">
              {povsArray.map((g) => getGroupListItem(g))}
            </div>
          </ScrollArea>
          <div className="w-full h-1 shadow-lg absolute bottom-0" />
        </>
      ) : (
        <div className="flex w-[250px] h-full items-center flex-col p-0 my-1 mx-2">
          {povsArray.map((g) => getGroupListItem(g))}
        </div>
      )}
    </div>
  );
}
