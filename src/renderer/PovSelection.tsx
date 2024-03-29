import {
  Box,
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

  const getPovListItem = (v: RendererVideo, index: number) => {
    const name = getPlayerName(v);
    const specID = getPlayerSpecID(v);
    const icon = Images.specImages[specID];
    const unitClass = getPlayerClass(v);
    const classColor = getWoWClassColor(unitClass);
    const key = v.cloud ? `${name}-cloud` : `${name}-disk`;
    const povSelected =
      parentButtonSelected && povs.length > 1 && localPovIndex === index;

    /**
     * Update state variables following a change of selected point of view.
     */
    const handleChangePov = (
      event: React.MouseEvent<HTMLElement>,
      povIndex: number
    ) => {
      event.stopPropagation();
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

    const getCloudIcon = () => {
      return (
        <Tooltip title="Saved on the cloud">
          <CloudIcon sx={{ color: 'white', height: '15px', width: '15px' }} />
        </Tooltip>
      );
    };

    const getDiskIcon = () => {
      return (
        <Tooltip title="Saved on local disk">
          <SaveIcon sx={{ color: 'white', height: '15px', width: '15px' }} />
        </Tooltip>
      );
    };

    return (
      <ListItem disablePadding sx={{ width: '100%', height: '25px' }} key={key}>
        <ListItemButton
          selected={povSelected}
          onClick={(event) => handleChangePov(event, index)}
          sx={listItemButtonSx}
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
            <Box sx={{ m: 1 }}>
              {v.cloud && getCloudIcon()}
              {!v.cloud && getDiskIcon()}
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
          ...scrollBarSx,
        }}
      >
        {povs.map((p, i) => getPovListItem(p, i))}
      </List>
    </Box>
  );
}
