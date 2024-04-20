import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderIcon from '@mui/icons-material/Folder';
import MessageIcon from '@mui/icons-material/Message';
import React, { MutableRefObject, useEffect, useState } from 'react';
import { RendererVideo, AppState } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LinkIcon from '@mui/icons-material/Link';
import {
  getResultColor,
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  getFormattedDuration,
  getVideoTime,
  getVideoDate,
  stopPropagation,
  povNameSort,
  countUniquePovs,
} from './rendererutils';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';
import BattlegroundInfo from './BattlegroundInfo';
import DungeonInfo from './DungeonInfo';
import ArenaInfo from './ArenaInfo';
import RaidCompAndResult from './RaidCompAndResult';
import TagDialog from './TagDialog';
import ControlIcon from '../../assets/icon/ctrl-icon.png';
import PovSelection from './PovSelection';
import { useSettings } from './useSettings';
import SnackBar from './SnackBar';
import StateManager from './StateManager';

interface IProps {
  selected: boolean;
  video: RendererVideo;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

const dialogButtonSx = {
  color: 'white',
  ':hover': {
    color: 'white',
    borderColor: '#bb4420',
    background: '#bb4420',
  },
};

const iconButtonSx = {
  boxShadow: 1,
  border: '1px ridge',
  borderRadius: '5px',
  mx: '2px',
  borderColor: 'rgba(0, 0, 0, 0.2)',
  '& .MuiTouchRipple-root .MuiTouchRipple-child': {
    borderRadius: '5px',
  },
};

const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: IProps) {
  const {
    selected,
    video,
    stateManager,
    videoState,
    setAppState,
    persistentProgress,
  } = props;
  const [config] = useSettings();
  const formattedDuration = getFormattedDuration(video);
  const isMythicPlus = isMythicPlusUtil(video);
  const isRaid = isRaidUtil(video);
  const isBattleground = isBattlegroundUtil(video);
  const isArena = isArenaUtil(video);
  const resultColor = getResultColor(video);
  const videoTime = getVideoTime(video);
  const videoDate = getVideoDate(video);

  const [ctrlDown, setCtrlDown] = useState<boolean>(false);
  const [tagDialogOpen, setTagDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [thumbnailSignedUrl, setThumbnailSignedUrl] = useState<string>('');
  const [localPovIndex, setLocalPovIndex] = useState<number>(0);
  const [linkSnackBarOpen, setLinkSnackBarOpen] = useState(false);

  const povs = [video, ...video.multiPov].sort(povNameSort);
  const pov = povs[localPovIndex];
  const { videoName, cloud, thumbnailSource, isProtected, tag, videoSource } =
    pov;

  // Check if we have this point of view duplicated in the other storage
  // type. Don't want to be showing the download button if we have already
  // got it on disk and vice versa.
  const haveOnDisk =
    !cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => !v.cloud)
      .length > 0;

  const haveInCloud =
    cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => v.cloud)
      .length > 0;

  const bookmarkOpacity = isProtected ? 1 : 0.2;
  const tagOpacity = tag ? 1 : 0.2;
  let tagTooltip: string = tag || 'Add a tag';

  if (tagTooltip.length > 50) {
    tagTooltip = `${tagTooltip.slice(0, 50)}...`;
  }

  // We do some hokey maths here to decide the height of the button, because
  // I've no idea how else to stop the image resizing the entire thing unless
  // its parent has an absolute size, super annoying.
  const uniquePovs = countUniquePovs(povs);
  const buttonHeight = Math.max(25 + uniquePovs * 25, 130);

  // Sign the thumbnail URL and render it.
  useEffect(() => {
    const getSignedThumbnailUrl = async () => {
      const url = await ipc.invoke('signGetUrl', [thumbnailSource]);
      setThumbnailSignedUrl(url);
    };

    if (cloud) {
      getSignedThumbnailUrl();
    } else {
      setThumbnailSignedUrl(thumbnailSource);
    }
  }, [cloud, thumbnailSource]);

  useEffect(() => {
    if (povs.length > localPovIndex) {
      return;
    }

    setLocalPovIndex(0);
  }, [localPovIndex, povs.length, selected]);

  /**
   * Delete a video. This avoids attempting to delete the video
   * from disk when the MP4 file is still open in the UI via the safeDelete
   * call.
   */
  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDeleteDialogOpen(false);

    const src = cloud ? videoName : videoSource;
    window.electron.ipcRenderer.sendMessage('safeDeleteVideo', [src, cloud]);
    stateManager.current.deleteVideo(pov);

    if (!selected) {
      return;
    }

    setLocalPovIndex(0);

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: undefined,
        playingVideo: undefined,
      };
    });
  };

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL. Also sets the callback on
   * unmount to delete the video if the delete button was clicked.
   */
  useEffect(() => {
    document.addEventListener('keyup', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(false);
      }
    });
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(true);
      }
    });
  });

  const openTagDialog = () => {
    setTagDialogOpen(true);
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    stateManager.current.toggleProtect(pov);
    const src = cloud ? videoName : videoSource;
    const bool = !isProtected;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'save',
      src,
      cloud,
      bool,
    ]);
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      videoSource,
      cloud,
    ]);
  };

  const deleteClicked = (event: React.MouseEvent<HTMLElement>) => {
    if (ctrlDown) {
      deleteVideo(event);
    } else {
      event.stopPropagation();
      setDeleteDialogOpen(true);
    }
  };

  const getTagDialog = () => {
    return (
      <TagDialog
        video={pov}
        tagDialogOpen={tagDialogOpen}
        setTagDialogOpen={setTagDialogOpen}
        stateManager={stateManager}
      />
    );
  };

  const getDeleteDialog = () => {
    return (
      <Dialog
        open={deleteDialogOpen}
        PaperProps={{ style: { backgroundColor: '#1A233A' } }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          Permanently Delete this Video?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'white' }}>
            Hold{' '}
            <img
              src={ControlIcon}
              alt="Control Key"
              width="35"
              height="35"
              style={{ verticalAlign: 'middle' }}
            />{' '}
            to skip this prompt.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              setDeleteDialogOpen(false);
            }}
            sx={dialogButtonSx}
          >
            Cancel
          </Button>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              deleteVideo(event);
            }}
            sx={dialogButtonSx}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const getOpenButton = () => {
    return (
      <Tooltip title="Open location">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={openLocation}
          sx={iconButtonSx}
        >
          <FolderIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const uploadVideo = async () => {
    ipc.sendMessage('videoButton', ['upload', videoSource]);
  };

  const getUploadButton = () => {
    return (
      <Tooltip title="Upload to cloud">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={uploadVideo}
          sx={iconButtonSx}
        >
          <UploadIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const downloadVideo = async () => {
    ipc.sendMessage('videoButton', ['download', pov]);
  };

  const getDownloadButton = () => {
    return (
      <Tooltip title="Download to disk">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={downloadVideo}
          sx={iconButtonSx}
        >
          <DownloadIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const getShareableLinkSnackBar = () => {
    return (
      <SnackBar
        message="Link copied!"
        timeout={2}
        open={linkSnackBarOpen}
        setOpen={setLinkSnackBarOpen}
      />
    );
  };

  const getShareableLink = async () => {
    return ipc.invoke('signGetUrl', [videoSource]);
  };

  const writeToClipBoard = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setLinkSnackBarOpen(true);
    const url = await getShareableLink();
    ipc.sendMessage('writeClipboard', [url]);
  };

  const getShareLinkButton = () => {
    return (
      <Tooltip title="Get sharable link">
        <div>
          {getShareableLinkSnackBar()}
          <IconButton
            onMouseDown={stopPropagation}
            onClick={writeToClipBoard}
            sx={iconButtonSx}
          >
            <LinkIcon sx={{ color: 'white' }} />
          </IconButton>
        </div>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
      }}
    >
      {getTagDialog()}
      {getDeleteDialog()}

      <Box
        sx={{
          border: '1px solid black',
          borderRadius: '5px',
          bgcolor: resultColor,
          width: '100%',
          height: `${buttonHeight}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          boxSizing: 'border-box',
        }}
      >
        <Box
          component="img"
          src={thumbnailSignedUrl}
          sx={{
            borderTopLeftRadius: '5px',
            borderBottomLeftRadius: '5px',
            borderRight: '1px solid black',
            width: '25%',
            minWidth: '25%',
            maxWidth: '25%',
            height: '100%',
            minHeight: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'black',
            boxSizing: 'border-box',
          }}
        />

        <Box
          sx={{
            height: '100%',
            width: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PovSelection
            povs={povs}
            parentButtonSelected={selected}
            localPovIndex={localPovIndex}
            setLocalPovIndex={setLocalPovIndex}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
          />
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaInfo video={video} />}
            {isMythicPlus && <DungeonInfo video={video} />}
            {isRaid && <RaidEncounterInfo video={video} />}
            {isBattleground && <BattlegroundInfo video={video} />}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaCompDisplay video={video} />}
            {isMythicPlus && <DungeonCompDisplay video={video} />}
            {isRaid && (
              <RaidCompAndResult
                video={video}
                raidCategoryState={videoState.filter(
                  (v) => v.category === VideoCategory.Raids
                )}
              />
            )}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              mx: 1,
            }}
          >
            <Tooltip title="Duration">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
                }}
              >
                <HourglassBottomIcon sx={{ color: 'white' }} />
                <Typography
                  sx={{
                    color: 'white',
                    fontWeight: '600',
                    fontFamily: '"Arial",sans-serif',
                    textShadow:
                      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                  }}
                >
                  {formattedDuration}
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Time">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
                }}
              >
                <AccessTimeIcon sx={{ color: 'white' }} />
                <Typography
                  sx={{
                    color: 'white',
                    fontWeight: '600',
                    fontFamily: '"Arial",sans-serif',
                    textShadow:
                      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                  }}
                >
                  {videoTime}
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Date">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
                }}
              >
                <EventIcon sx={{ color: 'white' }} />
                <Typography
                  sx={{
                    color: 'white',
                    fontWeight: '600',
                    fontFamily: '"Arial",sans-serif',
                    textShadow:
                      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                  }}
                >
                  {videoDate}
                </Typography>
              </Box>
            </Tooltip>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              mx: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tooltip title={tagTooltip}>
                <IconButton
                  onMouseDown={stopPropagation}
                  onClick={openTagDialog}
                  sx={iconButtonSx}
                >
                  <MessageIcon sx={{ color: 'white', opacity: tagOpacity }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Never age out">
                <IconButton
                  onMouseDown={stopPropagation}
                  onClick={protectVideo}
                  sx={iconButtonSx}
                >
                  <BookmarksIcon
                    sx={{ color: 'white', opacity: bookmarkOpacity }}
                  />
                </IconButton>
              </Tooltip>

              {cloud && getShareLinkButton()}
              {!cloud && getOpenButton()}
              {cloud && !haveOnDisk && getDownloadButton()}
              {!cloud &&
                !haveInCloud &&
                config.cloudUpload &&
                getUploadButton()}

              <Tooltip title="Delete">
                <IconButton
                  onMouseDown={stopPropagation}
                  onClick={deleteClicked}
                  sx={iconButtonSx}
                >
                  <DeleteForeverIcon sx={{ color: 'white' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
