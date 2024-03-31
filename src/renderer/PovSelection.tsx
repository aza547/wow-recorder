import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { scrollBarSx } from 'main/constants';
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

const listItemButtonSx = {
  display: 'flex',
  width: '100%',
  height: '25px',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0,
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '2px',
  },
};

const iconButtonSx = {
  height: '25px',
  width: '25px',
  borderRadius: '2px',
  '& .MuiTouchRipple-root .MuiTouchRipple-child': {
    borderRadius: '2px',
  },
};

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
    const classColor = getWoWClassColor(unitClass);

    /**
     * Update state variables following a change of selected point of view.
     */
    const handleChangePov = (
      event: React.MouseEvent<HTMLElement>,
      povIndex: number
    ) => {
      stopPropagation(event);
      setLocalPovIndex(povIndex);
      const video = povs[povIndex];

      if (!parentButtonSelected) {
        persistentProgress.current = 0;
      }

      setAppState((prevState) => {
        return {
          ...prevState,
          selectedVideoName: video.name,
          playingVideo: povs[povIndex],
        };
      });
    };

    /**
     * Return the cloud icon.
     */
    const getCloudIcon = () => {
      let opacity = 1;
      let title = 'Saved in the cloud';

      let onClick = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>
      ) => {
        handleChangePov(event, diskIndex);
      };

      if (!haveCloudVideo) {
        opacity = 0.2;
        title = 'No cloud recording is saved';
        onClick = stopPropagation;
      }

      return (
        <Tooltip title={title}>
          <IconButton
            onMouseDown={stopPropagation}
            onClick={onClick}
            sx={iconButtonSx}
          >
            <CloudIcon
              sx={{
                height: '15px',
                width: '15px',
                color: cloudButtonColor,
                opacity,
              }}
            />
          </IconButton>
        </Tooltip>
      );
    };

    /**
     * Return the disk icon.
     */
    const getDiskIcon = () => {
      let opacity = 1;
      let title = 'Saved on local disk';

      let onClick = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>
      ) => {
        handleChangePov(event, diskIndex);
      };

      if (!haveDiskVideo) {
        opacity = 0.2;
        title = 'No disk recording is saved';
        onClick = stopPropagation;
      }

      return (
        <Tooltip title={title}>
          <IconButton
            onMouseDown={stopPropagation}
            onClick={onClick}
            sx={iconButtonSx}
          >
            <SaveIcon
              sx={{
                height: '15px',
                width: '15px',
                color: diskButtonColor,
                opacity,
              }}
            />
          </IconButton>
        </Tooltip>
      );
    };

    return (
      <ListItem
        disablePadding
        sx={{ width: '100%', height: '25px' }}
        key={name}
      >
        <ListItemButton
          onMouseDown={stopPropagation}
          sx={listItemButtonSx}
          selected={povSelected}
          onClick={(event) => {
            if (haveCloudVideo) {
              handleChangePov(event, cloudIndex);
            } else {
              handleChangePov(event, diskIndex);
            }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '25px',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                width: '50px',
                minWidth: '50px',
              }}
            >
              {getCloudIcon()}
              {getDiskIcon()}
            </Box>
            <Box
              component="img"
              src={icon}
              sx={{
                height: '25px',
                width: '25px',
                border: '1px solid black',
                borderRadius: '2px',
                boxSizing: 'border-box',
                objectFit: 'cover',
              }}
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
              <Typography
                noWrap
                sx={{
                  color: 'black',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  fontFamily: 'Arial',
                }}
              >
                {name}
              </Typography>
            </Box>
          </Box>
        </ListItemButton>
      </ListItem>
    );
  };

  /**
   * Group the povs by name, grouping disk and cloud POVs for the
   * same video into a single group.
   */
  const groupByName = (arr: RendererVideo[]) => {
    return arr.reduce((acc: Record<string, RendererVideo[]>, obj) => {
      const { name } = obj;

      if (!acc[name]) {
        acc[name] = [];
      }

      acc[name].push(obj);
      return acc;
    }, {});
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'start',
        justifyContent: 'start',
        flexDirection: 'column',
        maxHeight: '100%',
        width: '100%',
      }}
    >
      <List
        dense
        sx={{
          display: 'flex',
          height: '100%',
          maxHeight: '100%',
          width: '250px',
          flexDirection: 'column',
          overflowY: 'auto',
          p: 0,
          my: 1,
          mx: 2,
          ...scrollBarSx,
        }}
      >
        {Object.values(groupByName(povs)).map((g) => getGroupListItem(g))}
      </List>
    </Box>
  );
}
